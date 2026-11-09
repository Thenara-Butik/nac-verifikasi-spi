module.exports = async function handler(req, res) {
  try {
    const table = req.query.table;
    if (!table) return res.status(400).json({ error: "table missing" });

    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const 【entity-key¦canonical_name=KEY】 = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !【entity-key¦canonical_name=KEY】) {
      return res.status(500).json({ error: "ENV missing: SUPABASE_URL / 【entity-KEY¦canonical_name=KEY】 belum di-set di Vercel" });
    }

    const cleanUrl = url.replace(/\/$/, "");
    const r = await fetch(`${cleanUrl}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: 【entity-key¦canonical_name=KEY】,
        Authorization: `Bearer ${key}`,
      },
    });

    const text = await r.text();
    res.status(r.status).setHeader("Content-Type", "application/json").send(text);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
};