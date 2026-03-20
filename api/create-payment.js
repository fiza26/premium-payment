import { createClient } from "@supabase/supabase-js";
import axios from "axios";

// Inisialisasi Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  // --- 1. HANDLING CORS (WAJIB ADA) ---
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*"); // Izinkan semua origin (localhost & production)
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
  );

  // Tangani Preflight Request (Browser OPTIONS check)
  if (req.method === "OPTIONS") {
    res.status(200).end(); // Kirim HTTP OK Status
    return;
  }

  // --- 2. VALIDASI METHOD POST ---
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { plan, userId, email } = req.body;

  // --- 3. LOGIKA HARGA (PASTIKAN NOMINAL BENAR) ---
  let amount = 0;
  if (plan === "3_month") amount = 20000;
  if (plan === "lifetime") amount = 100000; // Sesuai modal Rp100.000

  if (!userId || amount === 0) {
    return res
      .status(400)
      .json({ error: "Data tidak lengkap atau Plan tidak valid" });
  }

  // Generate Order ID unik
  const orderId = `WRK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    // --- 4. HIT API PAKASIR (Integrasi Baru) ---
    const pakasirResponse = await axios.post(
      "https://app.pakasir.com/api/transactioncreate/qris",
      {
        project: "worktraline", // Slug proyek di dashboard Pakasir
        order_id: orderId,
        amount: amount,
        api_key: process.env.PAKASIR_API_KEY,
      },
    );

    const paymentData = pakasirResponse.data.payment;

    // --- 5. SIMPAN KE SUPABASE (Gunakan kolom duitku_reference agar Polling React jalan) ---
    const { error: dbError } = await supabase.from("transactions").insert([
      {
        user_id: userId,
        email: email,
        amount: amount,
        status: "pending",
        order_id: orderId,
        duitku_reference: orderId, // Polling di UpgradeModal.jsx mencari nilai ini
        plan_type: plan,
        created_at: new Date(),
      },
    ]);

    if (dbError) throw dbError;

    // --- 6. RESPON KE FRONTEND ---
    return res.status(200).json({
      payment_number: paymentData.payment_number, // String QRIS Pakasir
      order_id: orderId,
      amount: amount,
    });
  } catch (error) {
    console.error("Payment Error:", error.response?.data || error.message);
    return res.status(500).json({
      error: "Gagal membuat transaksi Pakasir",
      details: error.response?.data || error.message,
    });
  }
}
