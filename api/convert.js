/* =========================================================
   /api/convert.js  (Vercel Serverless Function)
   ---------------------------------------------------------
   Purpose:
   - Secure proxy for ConvertAPI requests.
   - Keeps CONVERT_API_TOKEN secret (server-side only).
   - Forwards the incoming multipart/form-data upload to ConvertAPI
     and streams ConvertAPI's response back to the client.

   How it works:
   1) Frontend sends POST /api/convert?type=<convertapi-route>
      Example: /api/convert?type=docx/to/pdf
   2) This API builds the ConvertAPI target URL using:
      - type from req.query
      - Token from process.env.CONVERT_API_TOKEN
   3) It pipes the incoming request body directly to ConvertAPI,
      and pipes the ConvertAPI response directly back to the frontend.

   Requirements:
   - Set environment variable in Vercel:
     CONVERT_API_TOKEN

   Notes:
   - bodyParser is disabled so the raw stream can be piped (file uploads).
   - This keeps your ConvertAPI token private and avoids CORS issues.
   ========================================================= */

const https = require("https");

export default function handler(req, res) {
  // Only allow POST (file uploads)
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const rawType = req.query?.type;

    // Basic validation (prevents weird injections)
    if (!rawType || typeof rawType !== "string" || !rawType.includes("/to/")) {
      return res.status(400).json({ error: "Invalid or missing type" });
    }

    const type = encodeURIComponent(rawType);
    const secret = process.env.CONVERT_API_TOKEN;

    if (!secret) {
      return res.status(500).json({
        error: "Missing ConvertAPI secret",
        hint: "Set CONVERTAPI_SECRET in Vercel Environment Variables",
      });
    }

    // ✅ ConvertAPI v2 auth param should be Secret=...
    const targetUrl = `https://v2.convertapi.com/convert/${type}?Secret=${encodeURIComponent(secret)}&StoreFile=true`;

    const proxyReq = https.request(
      targetUrl,
      {
        method: "POST",
        // Forward content-type + boundaries, etc.
        headers: {
          "content-type": req.headers["content-type"] || "multipart/form-data",
          // keep other headers (but don't forward host)
          ...req.headers,
          host: "v2.convertapi.com",
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on("error", (err) => {
      console.error("ConvertAPI proxy error:", err);
      res.status(500).json({ error: "Proxy Request Failed" });
    });

    // Stream upload to ConvertAPI
    req.pipe(proxyReq);
  } catch (err) {
    console.error("ConvertAPI handler error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// Disable body parser so streaming works
export const config = {
  api: { bodyParser: false },
};
