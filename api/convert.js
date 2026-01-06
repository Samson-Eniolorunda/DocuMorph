/**
 * /api/convert (Vercel / Next.js API Route - Node runtime)
 * ---------------------------------------------------------
 * Purpose:
 * - Proxy multipart uploads from the browser to ConvertAPI securely.
 * - Keep ConvertAPI secret on the server (ENV).
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

// IMPORTANT (Next.js): disable body parsing so req stays a readable stream
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

function isValidConvertType(type) {
  // Basic hardening: allow only letters/numbers + dashes and "/to/" pattern.
  // Examples allowed: docx/to/pdf, pdf/to/docx, jpg/to/png, xlsx/to/pdf, pdf/to/merge, pdf/to/compress
  return /^[a-z0-9-]+\/to\/[a-z0-9-]+$/i.test(type);
}

module.exports = async (req, res) => {
  // Allow only POST (browser sends multipart/form-data)
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST");
    return res.end("Method Not Allowed");
  }

  const secret = process.env.CONVERTAPI_SECRET;
  const type = req.query?.type ? String(req.query.type).trim() : "";

  if (!secret) return res.status(500).end("Missing CONVERTAPI_SECRET");
  if (!type) return res.status(400).end("Missing type query param");

  // Security: block weird paths
  if (!isValidConvertType(type)) {
    return res.status(400).end("Invalid type format. Expected like: docx/to/pdf");
  }

  const targetUrl = new URL(
    `https://v2.convertapi.com/convert/${type}?Secret=${encodeURIComponent(secret)}`
  );

  // Build headers safely (never send undefined)
  const headers = {
    "content-type": req.headers["content-type"] || "application/octet-stream",
    "user-agent": "DocuMorph-Proxy/1.0",
  };

  // Only forward content-length if present
  if (req.headers["content-length"]) {
    headers["content-length"] = req.headers["content-length"];
  }

  const proxyReq = https.request(
    {
      method: "POST",
      hostname: targetUrl.hostname,
      path: targetUrl.pathname + targetUrl.search,
      headers,
      timeout: 120000, // 120s safety timeout
    },
    (proxyRes) => {
      // Forward status
      res.statusCode = proxyRes.statusCode || 502;

      // Forward content type (ConvertAPI usually returns JSON)
      const ct = proxyRes.headers["content-type"] || "application/json";
      res.setHeader("Content-Type", ct);

      // Optional: forward ConvertAPI request id headers if they exist
      if (proxyRes.headers["x-request-id"]) res.setHeader("x-request-id", proxyRes.headers["x-request-id"]);

      // Stream ConvertAPI response back to client
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("timeout", () => {
    proxyReq.destroy(new Error("Proxy timeout"));
  });

  proxyReq.on("error", (err) => {
    console.error("ConvertAPI proxy error:", err);
    if (!res.headersSent) res.statusCode = 502;
    res.end("Bad Gateway");
  });

  // Pipe multipart body to ConvertAPI
  req.pipe(proxyReq);
};
