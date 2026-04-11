// Vercel Serverless Function — proxies EmailJS server-side
// Avoids browser CSP / CORS blocks on api.emailjs.com

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const SERVICE_ID   = process.env.VITE_EMAILJS_SERVICE      || "service_pkjnqeg";
  const TEMPLATE_ID  = process.env.VITE_EMAILJS_TEMPLATE     || "template_s4l22xj";
  const PUBLIC_KEY   = process.env.VITE_EMAILJS_KEY          || "w3EVomJS4Qe3Chfan";
  const PRIVATE_KEY  = process.env.VITE_EMAILJS_PRIVATE_KEY  || "ZoHI1suYN0FI68PnoY950";

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
