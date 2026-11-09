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

    // POST = simpan / upsert (dipake tombol Simpan di Vite)
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? []);
      const r = await fetch(`${cleanUrl}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          apikey: key.trim(),
          Authorization: `Bearer ${key.trim()}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body,
      });
      const text = await r.text();
      return res.status(r.status).setHeader("Content-Type", "application/json").send(text);
    }

    // GET = baca (yang lama, jangan diubah)
    const r = await fetch(`${cleanUrl}/rest/v1/${table}?select=*`, {
      headers: { apikey: key.trim(), Authorization: `Bearer ${key.trim()}` },
    });
    const text = await r.text();
    res.status(r.status).setHeader("Content-Type", "application/json").send(text);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
