import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body;
    console.log("WijayaPay callback received:", body);

    const { ref_id, status, user_id } = body; // contoh, sesuaikan dengan response WijayaPay

    if (status === "PAID") {
      // update user subscription
      await supabase
        .from("subscriptions")
        .update({ status: "active", updated_at: new Date() })
        .eq("ref_id", ref_id);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
