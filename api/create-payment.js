import { createClient } from "@supabase/supabase-js";
import axios from "axios";

// Konfigurasi Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // Gunakan Service Role untuk bypass RLS saat insert
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { plan, userId, email } = req.body;

  // 1. Tentukan Harga Berdasarkan Plan
  let amount = 0;
  if (plan === "3_month") amount = 20000;
  if (plan === "lifetime") amount = 100000;

  // 2. Generate Order ID Unik
  const orderId = `WRK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    // 3. Panggil API Pakasir (Transaction Create)
    // Sesuai Dokumentasi C.2
    const pakasirResponse = await axios.post(
      "https://app.pakasir.com/api/transactioncreate/qris",
      {
        project: "worktraline", // Slug proyek kamu
        order_id: orderId,
        amount: amount,
        api_key: process.env.PAKASIR_API_KEY,
      },
    );

    const paymentData = pakasirResponse.data.payment;

    // 4. Simpan ke Database Supabase
    // Menggunakan nama kolom 'duitku_reference' agar sinkron dengan modal kamu
    const { error: dbError } = await supabase.from("transactions").insert([
      {
        user_id: userId,
        email: email,
        amount: amount,
        status: "pending",
        order_id: orderId, // Jika ada kolom order_id
        duitku_reference: orderId, // Menyimpan order_id Pakasir di kolom lama
        plan_type: plan,
        created_at: new Date(),
      },
    ]);

    if (dbError) throw dbError;

    // 5. Kirim Response balik ke Frontend React
    return res.status(200).json({
      payment_number: paymentData.payment_number, // String QRIS
      order_id: orderId,
      amount: amount,
    });
  } catch (error) {
    console.error("Payment Error:", error.response?.data || error.message);
    return res.status(500).json({
      error: "Failed to create payment",
      details: error.response?.data || error.message,
    });
  }
}
