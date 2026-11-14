// Vercel serverless function: proxies Supabase audio through the same origin
// This eliminates all CORS/Safari issues by serving audio from test.lingvoconnect.com
export const config = { api: { responseLimit: false } };

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).end("Missing url parameter");

  const decoded = decodeURIComponent(url);

  // Only proxy Supabase storage URLs for security
  if (!decoded.includes(".supabase.co/storage/")) {
    return res.status(403).end("Only Supabase storage URLs are allowed");
  }

  try {
    const upstream = await fetch(decoded, {
      headers: {
        ...(req.headers["range"] ? { Range: req.headers["range"] } : {}),
      },
    });

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");

    const cl = upstream.headers.get("content-length");
    const cr = upstream.headers.get("content-range");
    if (cl) res.setHeader("Content-Length", cl);
    if (cr) res.setHeader("Content-Range", cr);

    res.status(upstream.status);
    const buf = await upstream.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (err) {
    res.status(502).end("Proxy error: " + err.message);
  }
}
