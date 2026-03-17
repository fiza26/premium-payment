import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // 1. Tambahkan Header CORS (Sangat disarankan)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  // 2. Inisialisasi Supabase di DALAM handler agar aman dari error "required"
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Callback Error: Config Supabase tidak ditemukan");
    return res.status(200).send("Config Error"); // Tetap 200 agar gateway tidak retry terus
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { ref_id, status } = req.body;
    console.log(`Callback Received: ${ref_id} | Status: ${status}`);

    if (!ref_id || !status) {
      return res.status(200).send("OK - Data Incomplete");
    }

    if (status.toLowerCase() === "paid") {
      // 1. Update status transaksi
      const { data: trxData, error: trxError } = await supabase
        .from("transactions")
        .update({ status: "paid" })
        .eq("duitku_reference", ref_id)
        .select()
        .single();

      if (trxError) throw trxError;

      if (trxData) {
        // 2. Hitung durasi (3 bulan = 90 hari, sisanya dianggap Yearly/Lifetime)
        const daysToAdd = trxData.plan === "3_month" ? 90 : 3650;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + daysToAdd);

        // 3. Update profile user jadi premium
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            ispremium: true,
            plan: trxData.plan,
            premiumexpiry: expiryDate.toISOString(),
          })
          .eq("id", trxData.user_id);

        if (profileError) throw profileError;
        console.log(`User ${trxData.user_id} sukses diupgrade.`);
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Callback Processing Error:", err.message);
    return res.status(200).send("Internal Error Handled");
  }
}
