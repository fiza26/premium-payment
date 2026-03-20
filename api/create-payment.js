import { createClient } from "@supabase/supabase-js";

// Inisialisasi Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  // --- A. HANDLING CORS (Mencegah ERR_FAILED di Localhost) ---
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
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

  // --- B. LOGIKA API UTAMA ---
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { plan, userId, email } = req.body;

  // Tentukan Harga
  let amount = 0;
  if (plan === "3_month") amount = 20000;
  if (plan === "lifetime") amount = 100000;

  // Validasi input minimal
  if (!userId || amount === 0) {
    return res.status(400).json({ error: "Data user atau plan tidak valid" });
  }

  const orderId = `WRK-${Date.now()}`;

  try {
    // --- C. HIT API PAKASIR MENGGUNAKAN NATIVE FETCH (Ganti Axios) ---
    const pakasirRequest = await fetch(
      "https://app.pakasir.com/api/transactioncreate/qris",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project: "worktraline",
          order_id: orderId,
          amount: amount,
          api_key: process.env.PAKASIR_API_KEY,
        }),
      },
    );

    const responseData = await pakasirRequest.json();

    if (!pakasirRequest.ok) {
      throw new Error(responseData.message || "Gagal memanggil API Pakasir");
    }

    const paymentData = responseData.payment;

    // --- D. SIMPAN KE DATABASE (Kolom duitku_reference) ---
    const { error: dbError } = await supabase.from("transactions").insert([
      {
        user_id: userId,
        amount: amount,
        status: "pending",
        duitku_reference: orderId, // Digunakan untuk polling di frontend
        plan: plan,
        created_at: new Date(),
      },
    ]);

    if (dbError) throw dbError;

    // --- E. RESPONSE KE FRONTEND ---
    return res.status(200).json({
      payment_number: paymentData.payment_number, // String QRIS
      order_id: orderId,
      amount: amount,
    });
  } catch (error) {
    console.error("Payment Error:", error.message);
    return res.status(500).json({
      error: "Server Error",
      details: error.message,
    });
  }
}
