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
 *
 * Why this version:
 * - Buffers the incoming multipart body and forwards it with Content-Length.
 * - Fixes mobile/Safari cases where uploads may be chunked (no Content-Length),
 *   which can cause ConvertAPI to reject requests (e.g., 403).
 */

const https = require("https");

// IMPORTANT (Next.js): disable body parsing so req stays a readable stream
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

function isValidConvertType(type) {
  // allow only letters/numbers/dashes and "/to/" pattern.
  // examples: docx/to/pdf, pdf/to/docx, jpg/to/png, xlsx/to/pdf, pdf/to/merge, pdf/to/compress
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

  // ---------------------------------------------------------
  // 1) Buffer multipart body so we can ALWAYS send Content-Length
  // ---------------------------------------------------------
  const MAX_BYTES = 55 * 1024 * 1024; // ~55MB safety (UI limit is 50MB)
  const chunks = [];
  let total = 0;

  try {
    await new Promise((resolve, reject) => {
      req.on("data", (chunk) => {
        total += chunk.length;

        if (total > MAX_BYTES) {
          reject(new Error("Payload too large"));
          req.destroy();
          return;
        }

        chunks.push(chunk);
      });

      req.on("end", resolve);
      req.on("error", reject);
    });
  } catch (_) {
    res.status(413).end("File too large");
    return;
  }

  const body = Buffer.concat(chunks);

  // ---------------------------------------------------------
  // 2) Forward request to ConvertAPI with stable headers
  // ---------------------------------------------------------
  const headers = {
    "content-type": req.headers["content-type"] || "application/octet-stream",
    "content-length": String(body.length),
    "user-agent": "DocuMorph-Proxy/1.1",
  };

  const proxyReq = https.request(
    {
      method: "POST",
      hostname: targetUrl.hostname,
      path: targetUrl.pathname + targetUrl.search,
      headers,
      timeout: 120000, // 120s safety timeout
    },
    (proxyRes) => {
      // Forward status code from ConvertAPI
      res.statusCode = proxyRes.statusCode || 502;

      // Forward content type (ConvertAPI usually returns JSON)
      res.setHeader("Content-Type", proxyRes.headers["content-type"] || "application/json");

      // Optional: forward ConvertAPI request id if present
      if (proxyRes.headers["x-request-id"]) {
        res.setHeader("x-request-id", proxyRes.headers["x-request-id"]);
      }

      // Stream ConvertAPI response back to client
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("timeout", () => {
    proxyReq.destroy(new Error("Proxy timeout"));
  });

  proxyReq.on("error", (err) => {
    console.error("ConvertAPI proxy error:", err);
    if (!res.headersSent) res.status(502);
    res.end("Bad Gateway");
  });

  // ---------------------------------------------------------
  // 3) Send buffered body (not piping) to avoid chunked uploads
  // ---------------------------------------------------------
  proxyReq.end(body);
};
