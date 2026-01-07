/**
 * /api/blob-upload
 * ---------------------------------------------------------
 * Vercel Blob: Client Upload Route (Node runtime)
 *
 * Frontend uses:
 *   upload(pathname, file, { handleUploadUrl: '/api/blob-upload', multipart: true })
 * from @vercel/blob/client
 */

const MAX_BYTES = 50 * 1024 * 1024; // 50MB

module.exports = async (req, res) => {
  // CORS (safe even on same-origin; helps debugging)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST, OPTIONS");
    return res.end("Method Not Allowed");
  }

  const token =
    process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

  if (!token) {
    res.statusCode = 500;
    return res.end("Missing BLOB_READ_WRITE_TOKEN");
  }

  try {
    // Read JSON body sent by @vercel/blob/client upload()
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8") || "{}";
    const body = JSON.parse(raw);

    // Optional: basic size guard if the client provides it
    const contentLength = Number(body?.contentLength || 0);
    if (contentLength && contentLength > MAX_BYTES) {
      res.statusCode = 413;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ error: "File too large (max 50MB)" }));
    }

    const { handleUpload } = await import("@vercel/blob/client");

    const jsonResponse = await handleUpload({
      request: req,
      body,
      token,

      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: [
            // images
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/bmp",
            "image/tiff",

            // pdf
            "application/pdf",

            // office
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ],
          addRandomSuffix: true,
        };
      },

      onUploadCompleted: async ({ blob }) => {
        console.log("Blob upload completed:", blob?.url);
      },
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify(jsonResponse));
  } catch (err) {
    console.error("Blob upload route error:", err);
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: err?.message || "Blob upload route failed" }));
  }
};
