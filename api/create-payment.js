import { createClient } from "@supabase/supabase-js";
import axios from "axios";

// Inisialisasi Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  // --- 1. HANDLING CORS (PENTING AGAR TIDAK BLOCKED BROWSER) ---
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*"); // Bisa diganti domain production Anda nanti
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
  );

  // Tangani Preflight Request (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --- 2. VALIDASI METHOD ---
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { plan, userId, email } = req.body;

  // --- 3. LOGIKA HARGA ---
  let amount = 0;
  if (plan === "3_month") amount = 20000;
  if (plan === "lifetime") amount = 100000; // Sudah diperbaiki menjadi 100rb

  // Validasi input
  if (!userId || amount === 0) {
    return res.status(400).json({ error: "Invalid plan or missing User ID" });
  }

  // Generate Order ID unik untuk Worktraline
  const orderId = `WRK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    // --- 4. HIT API PAKASIR (Sesuai Dokumentasi C.2) ---
    const pakasirResponse = await axios.post(
      "https://app.pakasir.com/api/transactioncreate/qris",
      {
        project: "worktraline", // Slug proyek Anda di Pakasir
        order_id: orderId,
        amount: amount,
        api_key: process.env.PAKASIR_API_KEY,
      },
    );

    const paymentData = pakasirResponse.data.payment;

    // --- 5. SIMPAN KE DATABASE (Tetap gunakan kolom 'duitku_reference') ---
    const { error: dbError } = await supabase.from("transactions").insert([
      {
        user_id: userId,
        email: email,
        amount: amount,
        status: "pending",
        order_id: orderId,
        duitku_reference: orderId, // Polling React akan mencari nilai ini
        plan_type: plan,
        created_at: new Date(),
      },
    ]);

    if (dbError) throw dbError;

    // --- 6. KIRIM RESPONSE KE FRONTEND ---
    return res.status(200).json({
      payment_number: paymentData.payment_number, // Ini String QRIS
      order_id: orderId,
      amount: amount,
    });
  } catch (error) {
    console.error("Payment Error:", error.response?.data || error.message);
    return res.status(500).json({
      error: "Gagal membuat pembayaran Pakasir",
      details: error.response?.data || error.message,
    });
  }
}
