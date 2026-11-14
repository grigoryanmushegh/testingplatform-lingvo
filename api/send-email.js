// Vercel Serverless Function — proxies EmailJS server-side
// Avoids browser CSP / CORS blocks on api.emailjs.com

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const SERVICE_ID   = process.env.EMAILJS_SERVICE  || process.env.VITE_EMAILJS_SERVICE  || "";
  const TEMPLATE_ID  = process.env.EMAILJS_TEMPLATE || process.env.VITE_EMAILJS_TEMPLATE || "";
  const PUBLIC_KEY   = process.env.EMAILJS_KEY      || process.env.VITE_EMAILJS_KEY      || "";
  const PRIVATE_KEY  = process.env.EMAILJS_PRIVATE_KEY || process.env.VITE_EMAILJS_PRIVATE_KEY || "";

  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY || !PRIVATE_KEY) {
    return res.status(500).json({ error: "EmailJS is not configured on the server. Add EMAILJS_SERVICE, EMAILJS_TEMPLATE, EMAILJS_KEY, EMAILJS_PRIVATE_KEY in Vercel environment variables." });
  }

  const params = req.body || {};

  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id:      SERVICE_ID,
        template_id:     TEMPLATE_ID,
        user_id:         PUBLIC_KEY,
        accessToken:     PRIVATE_KEY,
        template_params: params,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: text });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
}
