/**
 * /api/form  (Vercel Serverless Function)
 * ---------------------------------------------------------
 * Purpose:
 * - Receives feature request submissions from the frontend
 * - Forwards them to your Formspree endpoint (or any webhook)
 *
 * Env required:
 *   FORMSPREE_ENDPOINT   (example: https://formspree.io/f/xxxxxx)
 */
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end("Method Not Allowed");
  }

  const endpoint = process.env.FORMSPREE_ENDPOINT;
  if (!endpoint) {
    res.statusCode = 500;
    return res.end("Missing FORMSPREE_ENDPOINT");
  }

  // Read raw body (Vercel Functions don't auto-parse JSON)
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", async () => {
    try {
      const data = raw ? JSON.parse(raw) : {};

      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });

      res.statusCode = r.status;
      res.setHeader("Content-Type", "application/json");
      const text = await r.text();
      return res.end(text || JSON.stringify({ ok: r.ok }));
    } catch (err) {
      console.error("Form proxy error:", err);
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false }));
    }
  });
};
