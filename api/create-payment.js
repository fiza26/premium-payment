import crypto from "crypto";
import querystring from "querystring";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  // --- BAGIAN CORS: WAJIB ADA AGAR TIDAK ERROR DI LOCALHOST ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Signature");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { plan, userId, email } = req.body;
    let amount = plan === "3_month" ? 20000 : 100000;

    const merchantCode = process.env.WIJAYAPAY_MERCHANT_CODE;
    const apiKey = process.env.WIJAYAPAY_API_KEY;
    const refId = `INV${Date.now()}`;

    // 1. Buat Signature: md5(code_merchant + api_key + ref_id)
    const xSignature = crypto
      .createHash("md5")
      .update(merchantCode + apiKey + refId)
      .digest("hex");

    // 2. Simpan transaksi ke tabel 'transactions' (Status: Pending)
    const { error: dbError } = await supabase.from("transactions").insert({
      user_id: userId,
      plan: plan,
      amount: amount,
      status: "pending",
      duitku_reference: refId,
    });

    if (dbError) throw new Error("Gagal menyimpan transaksi ke database");

    // 3. Format Body untuk WijayaPay (Form URL Encoded)
    const postData = querystring.stringify({
      code_merchant: merchantCode,
      api_key: apiKey,
      ref_id: refId,
      code_payment: "QRIS",
      nominal: amount,
      customer_email: email || "",
    });

    // 4. Request ke WijayaPay dengan X-Signature di Header
    const response = await fetch(
      "https://wijayapay.com/api/transaction/create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Signature": xSignature,
          "User-Agent": "insomnia/12.1.0",
        },
        body: postData,
      },
    );

    const data = await response.json();

    if (data.success) {
      // Kembalikan URL Gambar QRIS ke Frontend
      return res.status(200).json({
        paymentUrl: data.data?.qr_image || data.data?.checkout_url,
        refId: refId,
      });
    } else {
      return res.status(400).json({ error: data.message });
    }
  } catch (error) {
    console.error("Payment Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
