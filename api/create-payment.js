import { createClient } from "@supabase/supabase-js";
import axios from "axios";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  // --- A. HANDLING CORS ---
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*"); // Izinkan localhost & production
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
  );

  // Tangani Preflight (Penting!)
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // --- B. LOGIKA API UTAMA ---
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { plan, userId, email } = req.body;

  let amount = 0;
  if (plan === "3_month") amount = 20000;
  if (plan === "lifetime") amount = 100000;

  const orderId = `WRK-${Date.now()}`;

  try {
    const pakasirResponse = await axios.post(
      "https://app.pakasir.com/api/transactioncreate/qris",
      {
        project: "worktraline",
        order_id: orderId,
        amount: amount,
        api_key: process.env.PAKASIR_API_KEY,
      },
    );

    const paymentData = pakasirResponse.data.payment;

    const { error: dbError } = await supabase.from("transactions").insert([
      {
        user_id: userId,
        email: email,
        amount: amount,
        status: "pending",
        duitku_reference: orderId,
        plan_type: plan,
      },
    ]);

    if (dbError) throw dbError;

    return res.status(200).json({
      payment_number: paymentData.payment_number,
      order_id: orderId,
    });
  } catch (error) {
    console.error("Error:", error.message);
    return res.status(500).json({ error: "Server Error" });
  }
}
