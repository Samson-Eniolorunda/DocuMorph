/**
 * /api/convert  (Vercel Serverless Function)
 * ---------------------------------------------------------
 * Purpose:
 * - Proxy multipart uploads from the browser to ConvertAPI securely.
 * - Keeps your ConvertAPI Secret on the server (ENV).
 *
 * Frontend calls:
 *   POST /api/convert?type=<convertapi-route>
 * Example:
 *   /api/convert?type=docx/to/pdf
 *
 * Env required:
 *   CONVERTAPI_SECRET
 */
const https = require("https");

module.exports = async (req, res) => {
  // Only allow POST (browser sends multipart/form-data)
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end("Method Not Allowed");
  }

  const secret = process.env.CONVERTAPI_SECRET;
  const type = (req.query && req.query.type) ? String(req.query.type) : "";

  if (!secret) {
    res.statusCode = 500;
    return res.end("Missing CONVERTAPI_SECRET");
  }

  if (!type) {
    res.statusCode = 400;
    return res.end("Missing type query param");
  }

  const targetUrl = new URL(`https://v2.convertapi.com/convert/${type}?Secret=${encodeURIComponent(secret)}`);

  const proxyReq = https.request(
    {
      method: "POST",
      hostname: targetUrl.hostname,
      path: targetUrl.pathname + targetUrl.search,
      headers: {
        // Forward content-type + length for multipart boundary
        "content-type": req.headers["content-type"] || "application/octet-stream",
        "content-length": req.headers["content-length"] || undefined,
        "user-agent": "DocuMorph-Proxy/1.0",
      },
    },
    (proxyRes) => {
      res.statusCode = proxyRes.statusCode || 500;

      // ConvertAPI returns JSON
      const ct = proxyRes.headers["content-type"] || "application/json";
      res.setHeader("Content-Type", ct);

      // Stream response back to client
      proxyRes.on("data", (chunk) => res.write(chunk));
      proxyRes.on("end", () => res.end());
    }
  );

  proxyReq.on("error", (err) => {
    console.error("ConvertAPI proxy error:", err);
    res.statusCode = 502;
    res.end("Bad Gateway");
  });

  // Pipe multipart body to ConvertAPI
  req.pipe(proxyReq);
};
