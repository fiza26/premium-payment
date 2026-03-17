import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // Hanya izinkan metode POST
  if (req.method !== "POST") return res.status(405).end();

  try {
    const body = req.body;
    console.log("Payload Masuk:", JSON.stringify(body));

    // 1. Ambil ref_id dari dalam objek 'data' sesuai spek mereka
    const ref_id = body.data?.ref_id;
    const status = body.status; // "paid" ada di luar objek data

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

      // 2. Update status transaksi di database
      const { data: trx, error: trxErr } = await supabase
        .from("transactions")
        .update({ status: "paid" })
        .eq("duitku_reference", ref_id)
        .select()
        .single();

      if (trxErr) throw new Error("Database Update Error: " + trxErr.message);

      if (trx) {
        // 3. Upgrade user ke premium
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({
            ispremium: true,
            plan: trx.plan,
          })
          .eq("id", trx.user_id);

        if (profileErr)
          throw new Error("Profile Update Error: " + profileErr.message);
        console.log(`User ${trx.user_id} sukses menjadi Premium.`);
      }
    }

    // 4. WAJIB mengembalikan JSON ini sesuai dokumentasi mereka
    return res.status(200).json({ status: true });
  } catch (err) {
    console.error("Callback Processing Error:", err.message);
    // Tetap kirim JSON agar tidak dianggap error oleh sistem mereka
    return res.status(200).json({ status: false });
  }
}
