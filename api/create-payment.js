import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { plan, userId, email } = req.body;

    let amount = 0;
    if (plan === "3_month") amount = 20000;
    if (plan === "lifetime") amount = 100000;
    if (!amount) throw new Error("Invalid plan");

    const orderId = crypto.randomUUID();

    const url = `https://wijayapay.com/api/transaction/create`;

    const payload = {
      code_merchant: process.env.WIJAYAPAY_MERCHANT_CODE,
      api_key: process.env.WIJAYAPAY_API_KEY,
      ref_id: orderId,
      nominal: amount,
      callback_url: process.env.CALLBACK_URL || "",
      code_payment: "QRIS",
      customer_email: email || "",
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log("WijayaPay transaction response:", data);

    if (!data.success) {
      return res.status(400).json({ error: data.message });
    }

    return res.status(200).json({
      paymentUrl: data.data?.qr_image, // Bisa juga qr_string jika mau generate QR sendiri
      refId: orderId,
      trxReference: data.data?.trx_reference,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
