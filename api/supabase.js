export default async function handler(req, res) {
  try {
    const table = req.query.table || "nac_kertas";
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      return res.status(500).json({ error: "ENV missing", hasUrl: !!url, hasKey: !!key });
    }

    const cleanUrl = url.replace(/\/$/, "");
    const target = `${cleanUrl}/rest/v1/${table}?select=*&limit=1`;

    // Test 1: fetch tanpa header dulu, buat cek DNS / network
    let test1 = "not-tried";
    try {
      const r0 = await fetch(cleanUrl);
      test1 = "root-status-" + r0.status;
    } catch (e0) {
      test1 = "root-fail: " + String(e0?.message || e0) + " | cause: " + String(e0?.cause?.message || e0?.cause?.code || "");
    }

    // Test 2: fetch beneran pake key
    try {
      const r = await fetch(target, {
        headers: { apikey: key.trim(), Authorization: `Bearer ${key.trim()}` },
      });
      const text = await r.text();
      return res.status(200).json({ ok: true, test1, status: r.status, preview: text.slice(0, 500) });
    } catch (e) {
      return res.status(500).json({
        error: "fetch failed",
        detail: String(e?.message || e),
        cause: String(e?.cause?.message || e?.cause?.code || e?.cause || ""),
        test1,
        urlHost: cleanUrl,
        keyPrefix: key.slice(0, 15),
        keyLen: key.length,
        target,
      });
    }
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}