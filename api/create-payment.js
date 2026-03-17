import crypto from "crypto";
import querystring from "querystring";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // 1. SET HEADER CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Signature");

  if (req.method === "OPTIONS") return res.status(200).end();

  // 2. INISIALISASI SUPABASE DI DALAM HANDLER
  // Ini memastikan variabel environment sudah terbaca saat request diproses
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({
      error:
        "Konfigurasi Supabase belum lengkap di Environment Variables Vercel.",
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { plan, email, userId } = req.body;
    let nominal = plan === "3_month" ? 100 : 100000;

    const merchantCode = process.env.WIJAYAPAY_MERCHANT_CODE;
    const apiKey = process.env.WIJAYAPAY_API_KEY;
    const refId = `INV${Date.now()}`;

    // 1. Catat transaksi ke Supabase
    const { error: dbError } = await supabase.from("transactions").insert({
      user_id: userId,
      plan: plan,
      amount: nominal,
      status: "pending",
      duitku_reference: refId,
    });

    if (dbError) throw new Error(`Database Error: ${dbError.message}`);

    // 2. Hitung Signature
    const rawString = merchantCode + apiKey + refId;
    const xSignature = crypto.createHash("md5").update(rawString).digest("hex");

    // 3. Persiapkan Body untuk WijayaPay
    const formData = {
      code_merchant: merchantCode,
      api_key: apiKey,
      ref_id: refId,
      code_payment: "QRIS",
      nominal: nominal,
      customer_email: email || "",
    };

    const postData = querystring.stringify(formData);

    // 4. Kirim Request ke WijayaPay
    const response = await fetch(
      "https://wijayapay.com/api/transaction/create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "insomnia/12.1.0",
          "X-Signature": xSignature,
        },
        body: postData,
      },
    );

    const data = await response.json();

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
    console.error("Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
