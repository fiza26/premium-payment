// pages/api/create-payment.js
import fetch from "node-fetch";
import crypto from "crypto"; // Tambahkan ini

export default async function handler(req, res) {
  const allowedOrigin =
    process.env.NODE_ENV === "development" ? "http://localhost:5173" : "*";

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { plan, email } = req.body;

    let amount = 0;
    if (plan === "3_month") amount = 20000;
    if (plan === "lifetime") amount = 100000;
    if (!amount) throw new Error("Invalid plan");

    const merchantCode = process.env.WIJAYAPAY_MERCHANT_CODE;
    const apiKey = process.env.WIJAYAPAY_API_KEY;
    const orderId = `INV-${Date.now()}`; // Lebih stabil untuk ref_id

    // ==== PROSES PEMBUATAN SIGNATURE ====
    // Rumus MD5 umum: md5(code_merchant + ref_id + api_key)
    const signature = crypto
      .createHash("md5")
      .update(merchantCode + orderId + apiKey)
      .digest("hex");

    const payload = {
      code_merchant: merchantCode,
      api_key: apiKey,
      ref_id: orderId,
      nominal: amount,
      code_payment: "QRIS",
      signature: signature, // WAJIB DIKIRIM
      callback_url: process.env.CALLBACK_URL || "",
      customer_email: email || "",
    };

    const response = await fetch(
      "https://wijayapay.com/api/transaction/create",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const data = await response.json();
    console.log("WijayaPay Response:", data);

    if (!data.success) {
      return res.status(400).json({ error: data.message });
    }

    // Pastikan mapping data sesuai dengan response WijayaPay
    return res.status(200).json({
      paymentUrl: data.data?.checkout_url || data.data?.qr_image,
      refId: orderId,
      trxReference: data.data?.trx_reference,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
