/**
 * /api/convert (Vercel / Next.js API Route - Node runtime)
 * ---------------------------------------------------------
 * Proxies uploads to ConvertAPI while keeping CONVERTAPI_SECRET server-side.
 * Fixes mobile 403 by avoiding chunked uploads when Content-Length is missing.
 */

const https = require("https");

module.exports.config = {
  api: { bodyParser: false },
};

function isValidConvertType(type) {
  return /^[a-z0-9-]+\/to\/[a-z0-9-]+$/i.test(type);
}

function readStream(req, maxBytes = 55 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Upload too large for proxy buffer"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
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

  const targetUrl = new URL(`https://v2.convertapi.com/convert/${type}`);
  targetUrl.searchParams.set("Secret", secret);

  const contentType = req.headers["content-type"] || "application/octet-stream";
  const contentLength = req.headers["content-length"]; // may be missing on some mobile flows

  // If Content-Length exists, stream normally. If not, buffer and set it (avoids chunked upstream).
  let bufferedBody = null;
  if (!contentLength) {
    try {
      bufferedBody = await readStream(req);
    } catch (e) {
      console.error("Proxy buffer error:", e);
      return res.status(413).end("Upload too large or stream read failed");
    }
  }

  const headers = {
    "content-type": contentType,
    "user-agent": "DocuMorph-Proxy/1.1",
    "accept": "application/json",
    ...(contentLength ? { "content-length": contentLength } : { "content-length": String(bufferedBody.length) }),
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
      const ct = proxyRes.headers["content-type"] || "application/json";
      res.status(proxyRes.statusCode || 502);
      res.setHeader("Content-Type", ct);

      // Buffer ConvertAPI error response so you can actually see it in DevTools / response body
      const respChunks = [];
      proxyRes.on("data", (c) => respChunks.push(c));
      proxyRes.on("end", () => {
        const body = Buffer.concat(respChunks);

        // Helpful server log (visible in Vercel logs)
        if ((proxyRes.statusCode || 0) >= 400) {
          console.error("ConvertAPI error:", proxyRes.statusCode, body.toString("utf8").slice(0, 2000));
        }

        res.end(body);
      });
    }
  );

  proxyReq.on("timeout", () => proxyReq.destroy(new Error("Proxy timeout")));

  proxyReq.on("error", (err) => {
    console.error("ConvertAPI proxy error:", err);
    if (!res.headersSent) res.status(502);
    res.end("Bad Gateway");
  });

  if (bufferedBody) {
    proxyReq.end(bufferedBody);
  } else {
    req.pipe(proxyReq);
  }
};
