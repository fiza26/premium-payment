import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    // TIPS: Jika req.body kosong, Vercel terkadang butuh parsing manual
    // tapi biasanya Vercel sudah menangani ini secara otomatis.
    const { ref_id, status } = req.body;

    console.log(`Callback Received: ${ref_id} | Status: ${status}`);

    // Validasi dasar agar tidak error jika body kosong
    if (!ref_id || !status) {
      console.log("Data callback tidak lengkap");
      return res.status(200).send("OK"); // Tetap kirim OK agar tidak di-retry terus
    }

    if (status.toLowerCase() === "paid") {
      const { data: trxData, error: trxError } = await supabase
        .from("transactions")
        .update({ status: "paid" })
        .eq("duitku_reference", ref_id)
        .select()
        .single();

      if (trxError) {
        console.error("Trx Update Error:", trxError.message);
        throw trxError;
      }

      if (trxData) {
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

        if (profileError) {
          console.error("Profile Update Error:", profileError.message);
          throw profileError;
        }

        console.log(`User ${trxData.user_id} is now Premium.`);
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Callback Processing Error:", err.message);
    // Kita kirim 200 agar WijayaPay menganggap request sampai,
    // tapi kita log error-nya untuk debugging kita sendiri.
    return res.status(200).send("Error handled");
  }
}
