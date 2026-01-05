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

export default async function handler(req, res) {
  // -----------------------------
  // Only allow POST requests
  // -----------------------------
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // -----------------------------
    // Read convert type from query
    // e.g. docx/to/pdf, pdf/to/docx, pdf/to/compress, etc.
    // -----------------------------
    const { type } = req.query;

    // -----------------------------
    // Read ConvertAPI token from env
    // -----------------------------
    const token = process.env.CONVERT_API_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "Server Config Error" });
    }

    // -----------------------------
    // Build ConvertAPI request URL
    // StoreFile=true ensures ConvertAPI returns a hosted file URL
    // -----------------------------
    const targetUrl = `https://v2.convertapi.com/convert/${type}?Token=${token}&StoreFile=true`;

    // -----------------------------
    // Create proxy request to ConvertAPI
    // -----------------------------
    const proxyReq = https.request(
      targetUrl,
      {
        method: "POST",
        // Forward headers but override "host" for the upstream domain
        headers: { ...req.headers, host: "v2.convertapi.com" },
      },
      (proxyRes) => {
        // Relay status + headers from ConvertAPI to client
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        // Stream ConvertAPI response back to client
        proxyRes.pipe(res);
      }
    );

    // -----------------------------
    // Error handling for upstream request
    // -----------------------------
    proxyReq.on("error", () => {
      res.status(500).json({ error: "Proxy Request Failed" });
    });

    // -----------------------------
    // Pipe incoming request stream to ConvertAPI
    // (supports file uploads without buffering in memory)
    // -----------------------------
    req.pipe(proxyReq);
  } catch (_) {
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// IMPORTANT: Disable body parsing so req is a raw stream (multipart/form-data)
export const config = {
  api: { bodyParser: false },
};
