/**
 * /api/blob-upload
 * Vercel Blob: Client Upload Route (Node runtime)
 * iOS-Compatible Upload Handler
 */
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB

module.exports.config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60, // Extend timeout for iOS
};

async function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    // 1. SAFETY CHECK: If Vercel already parsed the body, use it!
    if (req.body) {
      try {
        const parsed =
          typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        return resolve(parsed);
      } catch (err) {
        console.log("Body parse error:", err);
        return resolve({});
      }
    }

    // 2. Read the raw stream manually (iOS-compatible)
    const chunks = [];
    let total = 0;
    let completed = false;

    const timeout = setTimeout(() => {
      if (!completed) {
        completed = true;
        reject(new Error("Request body read timeout"));
      }
    }, 30000); // 30s timeout

    req.on("data", (chunk) => {
      if (completed) return;

      try {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buf.length;

        if (total > maxBytes) {
          completed = true;
          clearTimeout(timeout);
          reject(new Error("Request body too large"));
          return;
        }
        chunks.push(buf);
      } catch (err) {
        completed = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    req.on("end", () => {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);

      try {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}";
        const parsed = JSON.parse(raw);
        resolve(parsed);
      } catch (err) {
        console.log("JSON parse error, returning empty object:", err);
        resolve({});
      }
    });

    req.on("error", (err) => {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);
      console.error("Request stream error:", err);
      reject(err);
    });
  });
}

module.exports = async (req, res) => {
  // Enhanced CORS headers for iOS compatibility
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Content-Length, X-Requested-With",
  );
  res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours

  // iOS Safari specific headers
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "Method Not Allowed" }));
  }

  // TOKEN CHECK
  const token =
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

  if (!token) {
    console.error("SERVER ERROR: No Token Found");
    res.statusCode = 500;
    return res.end(
      JSON.stringify({ error: "Missing blob token (Server Misconfigured)" }),
    );
  }

  try {
    const { handleUpload } = await import("@vercel/blob/client");

    // Read body with timeout handling
    let body;
    try {
      body = await readJsonBody(req);
    } catch (readErr) {
      console.error("Body read error:", readErr);
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Failed to read request body" }));
    }

    // DEBUG LOG: See exactly what we received
    console.log("DEBUG BODY:", JSON.stringify(body).substring(0, 200));

    // Validate body has required fields
    if (!body || typeof body !== "object") {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Invalid request body" }));
    }

    const jsonResponse = await handleUpload({
      body,
      token,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        console.log("Generating token for:", pathname);

        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/octet-stream", // iOS fallback
          ],
          addRandomSuffix: true,
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("Upload success:", blob.url);
      },
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(jsonResponse));
  } catch (err) {
    console.error("HANDLE UPLOAD ERROR:", err);
    console.error("Error stack:", err.stack);

    // Return proper error responses
    const errorMessage = err.message || "Unknown Error";
    const isTimeout = errorMessage.toLowerCase().includes("timeout");

    res.statusCode = isTimeout ? 408 : 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        error: errorMessage,
        code: err.code || "UPLOAD_ERROR",
        details: process.env.NODE_ENV === "development" ? err.stack : undefined,
      }),
    );
  }
};
