import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { ref_id, status } = req.body;
    console.log(`Callback Received: ${ref_id} | Status: ${status}`);

    if (status?.toLowerCase() === "paid") {
      // 1. Update status di tabel 'transactions'
      const { data: trxData, error: trxError } = await supabase
        .from("transactions")
        .update({ status: "paid" })
        .eq("duitku_reference", ref_id)
        .select()
        .single();

      if (trxError) throw trxError;

      // 2. Update status di tabel 'profiles' jika transaksi ditemukan
      if (trxData) {
        // Logika durasi (90 hari untuk 3 bulan, sangat lama untuk lifetime)
        const daysToAdd = trxData.plan === "3_month" ? 90 : 3650;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + daysToAdd);

        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            ispremium: true,
            plan: trxData.plan,
            premiumexpiry: expiryDate.toISOString(),
          })
          .eq("id", trxData.user_id);

        if (profileError) throw profileError;
        console.log(`User ${trxData.user_id} is now Premium.`);
      }
    }

    // WijayaPay butuh respon teks 'OK' untuk berhenti mengirim callback
    return res.status(200).send("OK");
  } catch (err) {
    console.error("Callback Processing Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
