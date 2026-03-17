import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const body = req.body;
    console.log("Payload Masuk:", JSON.stringify(body));

    const ref_id = body.data?.ref_id;
    const status = body.status;

    console.log(`Memproses Callback -> RefID: ${ref_id} | Status: ${status}`);

    if (!ref_id || !status) {
      console.error("Payload tidak sesuai struktur dokumentasi");
      return res.status(200).json({ status: false });
    }

    if (status === "paid") {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      );

      // 1. Update status transaksi
      const { data: trx, error: trxErr } = await supabase
        .from("transactions")
        .update({ status: "paid" })
        .eq("duitku_reference", ref_id)
        .select()
        .single();

      if (trxErr) throw new Error("Database Update Error: " + trxErr.message);

      if (trx) {
        // --- LOGIKA BARU DI SINI ---
        // Hitung durasi berdasarkan plan (3_month = 90 hari, sisanya dianggap 10 tahun/lifetime)
        const daysToAdd = trx.plan === "3_month" ? 90 : 3650;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + daysToAdd);
        // ---------------------------

        // 2. Upgrade user ke premium + isi expiry date
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({
            ispremium: true,
            plan: trx.plan,
            premiumexpiry: expiryDate.toISOString(), // Masukkan ke kolom ini
          })
          .eq("id", trx.user_id);

        if (profileErr)
          throw new Error("Profile Update Error: " + profileErr.message);

        console.log(
          `User ${trx.user_id} sukses menjadi Premium hingga ${expiryDate.toDateString()}.`,
        );
      }
    }

    return res.status(200).json({ status: true });
  } catch (err) {
    console.error("Callback Processing Error:", err.message);
    return res.status(200).json({ status: false });
  }
}
