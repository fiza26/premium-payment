import crypto from "crypto";
import querystring from "querystring";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  // --- 1. SET HEADER CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*"); // Izinkan semua origin
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Signature");

  // --- 2. TANGANI PREFLIGHT (OPTIONS) ---
  // Browser akan mengirim OPTIONS dulu sebelum POST. Jika tidak dijawab 200, akan error CORS.
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { plan, userId, email } = req.body;
    // ... sisa kode pembayaran kamu ...

    // Contoh logic singkat untuk testing:
    const merchantCode = process.env.WIJAYAPAY_MERCHANT_CODE;
    const apiKey = process.env.WIJAYAPAY_API_KEY;
    const refId = `INV${Date.now()}`;
    const amount = plan === "3_month" ? 20000 : 100000;

    const xSignature = crypto
      .createHash("md5")
      .update(merchantCode + apiKey + refId)
      .digest("hex");

    const postData = querystring.stringify({
      code_merchant: merchantCode,
      api_key: apiKey,
      ref_id: refId,
      code_payment: "QRIS",
      nominal: amount,
    });

    const response = await fetch(
      "https://wijayapay.com/api/transaction/create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Signature": xSignature,
        },
        body: postData,
      },
    );

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
