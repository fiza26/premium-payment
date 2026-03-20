import { createClient } from "@supabase/supabase-js";

// Inisialisasi di luar agar lebih cepat (Reused across warm executions)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const body = req.body;
    const { order_id, status, project } = body;

    console.log(`Incoming Webhook: Order ${order_id} | Status: ${status}`);

    // Validasi dasar
    if (!order_id || status !== "completed" || project !== "worktraline") {
      return res
        .status(200)
        .json({ status: false, message: "Invalid payload or not completed" });
    }

    // 1. Update status transaksi di tabel 'transactions'
    const { data: trx, error: trxErr } = await supabase
      .from("transactions")
      .update({ status: "paid" })
      .eq("duitku_reference", order_id)
      .select()
      .single();

    if (trxErr) throw new Error("Database Update Error: " + trxErr.message);

    if (trx) {
      // 2. Hitung durasi
      const daysToAdd = trx.plan_type === "3_month" ? 90 : 3650;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + daysToAdd);

      // 3. Upgrade user di tabel 'profiles'
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          ispremium: true,
          plan: trx.plan_type,
          premiumexpiry: expiryDate.toISOString(),
        })
        .eq("id", trx.user_id);

      if (profileErr)
        throw new Error("Profile Update Error: " + profileErr.message);

      console.log(
        `Success: User ${trx.user_id} upgraded until ${expiryDate.toDateString()}`,
      );
    }

    return res.status(200).json({ status: true });
  } catch (err) {
    console.error("Webhook Error:", err.message);
    // Kita kirim 200 OK agar Pakasir berhenti mencoba (retry) jika ada error logika
    return res.status(200).json({ status: false, error: err.message });
  }
}
