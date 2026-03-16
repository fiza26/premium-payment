import crypto from "crypto";
import querystring from "querystring";

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Signature");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { plan, email } = req.body;
    let nominal = plan === "3_month" ? 20000 : 100000;

    const merchantCode = process.env.WIJAYAPAY_MERCHANT_CODE;
    const apiKey = process.env.WIJAYAPAY_API_KEY;
    const refId = `INV${Date.now()}`;

    // 1. Hitung Signature: md5(codemerchant + api_key + ref_id)
    const rawString = merchantCode + apiKey + refId;
    const xSignature = crypto.createHash("md5").update(rawString).digest("hex");

    // 2. Format body sebagai URL Encoded (sesuai contoh PHP: nominal tanpa tanda kutip di string)
    const formData = {
      code_merchant: merchantCode,
      api_key: apiKey,
      ref_id: refId,
      code_payment: "QRIS",
      nominal: nominal,
    };

    // Mengubah object jadi string: code_merchant=WP...&api_key=...
    const postData = querystring.stringify(formData);

    console.log("String Hash:", rawString);
    console.log("X-Signature:", xSignature);

    // 3. Kirim Request
    const response = await fetch(
      "https://wijayapay.com/api/transaction/create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "insomnia/12.1.0",
          "X-Signature": xSignature, // TARUH DI HEADER, BUKAN DI BODY
        },
        body: postData,
      },
    );

    const data = await response.json();
    console.log("Respon WijayaPay:", data);

    if (data.success) {
      return res.status(200).json({
        paymentUrl:
          data.data?.checkout_url ||
          data.data?.qr_image ||
          data.data?.payment_url,
        refId: refId,
      });
    } else {
      return res.status(400).json({ error: data.message });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
