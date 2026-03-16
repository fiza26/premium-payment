import crypto from "crypto";

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { plan, email } = req.body;

    // 1. Tentukan nominal (harus angka/integer)
    let nominal = plan === "3_month" ? 20000 : 100000;

    const merchantCode = process.env.WIJAYAPAY_MERCHANT_CODE;
    const apiKey = process.env.WIJAYAPAY_API_KEY;

    // Gunakan ref_id yang lebih simpel dulu untuk testing
    const refId = `INV${Date.now()}`;

    // 2. BUAT SIGNATURE
    // Rumus: md5(merchant_code + ref_id + api_key)
    // Pastikan tidak ada spasi di antara penggabungan string ini
    const signature = crypto
      .createHash("md5")
      .update(merchantCode + refId + apiKey)
      .digest("hex");

    const payload = {
      code_merchant: merchantCode,
      api_key: apiKey,
      code_payment: "QRIS",
      ref_id: refId,
      nominal: nominal,
      signature: signature, // Ini yang tadi membuat error jika tidak ada
      callback_url: process.env.CALLBACK_URL || "",
      customer_email: email || "customer@mail.com",
    };

    console.log("Payload dikirim:", payload); // Cek di Vercel Logs

    const response = await fetch(
      "https://wijayapay.com/api/transaction/create",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const data = await response.json();
    console.log("Respon WijayaPay:", data);

    if (data.success) {
      return res.status(200).json({
        paymentUrl: data.data.checkout_url || data.data.qr_image,
        refId: refId,
      });
    } else {
      // Jika error signature muncul lagi, cek log Vercel untuk lihat data.message
      return res.status(400).json({ error: data.message });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
