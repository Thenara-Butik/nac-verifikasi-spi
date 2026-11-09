export default async function handler(req, res) {
  try {
    const table = req.query.table;
    if (!table) return res.status(400).json({ error: "table missing" });
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      return res.status(500).json({ error: "ENV missing" });
    }
    const cleanUrl = url.replace(/\/$/, "");
    const r = await fetch(`${cleanUrl}/rest/v1/${table}?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const text = await r.text();
    res.status(r.status).setHeader("Content-Type", "application/json").send(text);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}