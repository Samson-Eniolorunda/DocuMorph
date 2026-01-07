/**
 * /api/convert (Vercel / Next.js API Route - Node runtime)
 * Proxy multipart uploads -> ConvertAPI securely (keeps secret on server).
 */

const https = require("https");

module.exports.config = {
  api: { bodyParser: false },
};

function isValidConvertType(type) {
  return /^[a-z0-9-]+\/to\/[a-z0-9-]+$/i.test(type);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST");
    return res.end("Method Not Allowed");
  }

  const secret = process.env.CONVERTAPI_SECRET;
  const type = req.query?.type ? String(req.query.type).trim() : "";

  if (!secret) return res.status(500).end("Missing CONVERTAPI_SECRET");
  if (!type) return res.status(400).end("Missing type query param");
  if (!isValidConvertType(type)) {
    return res.status(400).end("Invalid type format. Expected like: docx/to/pdf");
  }

  // ✅ use lowercase 'secret' param (per ConvertAPI docs)
  const targetUrl = new URL(`https://v2.convertapi.com/convert/${type}`);
  targetUrl.searchParams.set("secret", secret);

  // Buffer multipart body so we can set Content-Length
  const MAX_BYTES = 55 * 1024 * 1024;
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

  const headers = {
    "content-type": req.headers["content-type"] || "application/octet-stream",
    "content-length": String(body.length),
    "user-agent": "DocuMorph-Proxy/1.2",
    accept: "application/json",
  };

  const proxyReq = https.request(
    {
      method: "POST",
      hostname: targetUrl.hostname,
      path: targetUrl.pathname + targetUrl.search,
      headers,
      timeout: 120000,
    },
    (proxyRes) => {
      const status = proxyRes.statusCode || 502;
      const ct = proxyRes.headers["content-type"] || "application/json";
      res.statusCode = status;
      res.setHeader("Content-Type", ct);

      // ✅ If ConvertAPI returns an error (403/401/400/500 etc), log the body to Vercel logs
      if (status !== 200) {
        let raw = "";
        proxyRes.on("data", (c) => (raw += c.toString("utf8")));
        proxyRes.on("end", () => {
          console.error("ConvertAPI error:", {
            status,
            type,
            body: raw.slice(0, 2000), // log first 2k chars
          });
          // still return it to the client (even though your JS only shows the status)
          res.end(raw || `ConvertAPI failed with status ${status}`);
        });
        return;
      }

      // Success: stream through
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("timeout", () => proxyReq.destroy(new Error("Proxy timeout")));

  proxyReq.on("error", (err) => {
    console.error("ConvertAPI proxy error:", err);
    if (!res.headersSent) res.status(502);
    res.end("Bad Gateway");
  });

  proxyReq.end(body);
};
