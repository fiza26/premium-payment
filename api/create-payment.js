import crypto from "crypto";

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { plan, email } = req.body;

    let nominal = plan === "3_month" ? 20000 : 100000;
    const merchantCode = process.env.WIJAYAPAY_MERCHANT_CODE;
    const apiKey = process.env.WIJAYAPAY_API_KEY;

    // Gunakan ref_id yang bersih tanpa karakter aneh
    const refId = `INV${Date.now()}`;

    // ==== PERBAIKAN SIGNATURE SESUAI DOC ====
    // Rumus: md5(code_merchant + api_key + ref_id)
    const rawString = merchantCode + apiKey + refId;
    const xSignature = crypto.createHash("md5").update(rawString).digest("hex");

    const payload = {
      code_merchant: merchantCode,
      api_key: apiKey,
      code_payment: "QRIS",
      ref_id: refId,
      nominal: nominal,
      "X-Signature": xSignature, // Gunakan nama parameter sesuai doc
      callback_url: process.env.CALLBACK_URL || "",
      customer_email: email || "customer@mail.com",
    };

    console.log("String yang di-hash:", rawString);
    console.log("X-Signature:", xSignature);

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
        paymentUrl:
          data.data.checkout_url || data.data.qr_image || data.data.payment_url,
        refId: refId,
      });
    } else {
      return res.status(400).json({ error: data.message });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
