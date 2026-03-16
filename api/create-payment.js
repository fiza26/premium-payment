import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).setHeader("Access-Control-Allow-Origin", "*").end();
  }

  try {
    const { plan, userId, email } = req.body;

    let amount = 0;
    if (plan === "3_month") amount = 20000;
    if (plan === "lifetime") amount = 100000;

    if (!amount) throw new Error("Invalid plan");

    const orderId = crypto.randomUUID();

    const url = `https://wijayapay.com/api/transaction/create`;

    const body = {
      code_merchant: process.env.WIJAYAPAY_MERCHANT_CODE,
      api_key: process.env.WIJAYAPAY_API_KEY,
      ref_id: orderId,
      nominal: amount,
      callback_url: process.env.CALLBACK_URL,
      payment_method: "QRIS",
      customer_email: email || "",
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log("WijayaPay transaction response:", data);

    res.status(200).json({ paymentUrl: data?.data?.qr_image || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
