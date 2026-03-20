import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // Pakasir mengirimkan POST request
  if (req.method !== "POST") return res.status(405).end();

  try {
    const body = req.body;
    console.log("Payload Webhook Pakasir Masuk:", JSON.stringify(body));

    // Mapping data sesuai dokumentasi Pakasir Bagian D
    const order_id = body.order_id; // Ini yang kita simpan di 'duitku_reference'
    const status = body.status; // 'completed' jika sukses
    const project = body.project; // Pastikan ini 'worktraline'

    console.log(
      `Memproses Webhook -> OrderID: ${order_id} | Status: ${status}`,
    );

    if (!order_id || !status) {
      console.error("Payload Pakasir tidak lengkap");
      return res.status(200).json({ status: false });
    }

    // Pakasir menggunakan status "completed" untuk pembayaran berhasil
    if (status === "completed" && project === "worktraline") {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      );

      // 1. Update status transaksi di tabel transactions
      // Kita cari berdasarkan 'duitku_reference' karena backend create-payment menyimpannya di sana
      const { data: trx, error: trxErr } = await supabase
        .from("transactions")
        .update({ status: "paid" })
        .eq("duitku_reference", order_id)
        .select()
        .single();

      if (trxErr) throw new Error("Database Update Error: " + trxErr.message);

      if (trx) {
        // --- LOGIKA DURASI PREMIUM ---
        // Menggunakan kolom 'plan_type' sesuai insert di create-payment tadi
        const daysToAdd = trx.plan_type === "3_month" ? 90 : 3650;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + daysToAdd);

        // 2. Upgrade user ke premium di tabel profiles
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
          `User ${trx.user_id} sukses menjadi Premium via Pakasir hingga ${expiryDate.toDateString()}.`,
        );
      }
    }

    // Pakasir mengharapkan respon sukses (200 OK)
    return res.status(200).json({ status: true });
  } catch (err) {
    console.error("Webhook Processing Error:", err.message);
    // Tetap kirim 200 agar Pakasir tidak terus-menerus mencoba mengirim ulang payload yang rusak
    return res.status(200).json({ status: false, message: err.message });
  }
}
