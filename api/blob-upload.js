/**
 * /api/blob-upload
 * ---------------------------------------------------------
 * Vercel Blob: Client Upload Route (Node runtime)
 */

const MAX_BYTES = 50 * 1024 * 1024; // 50MB

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }

  const token =
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

  if (!token) {
    res.statusCode = 500;
    return res.end("Missing BLOB_READ_WRITE_TOKEN");
  }

  try {
    const { handleUpload } = await import("@vercel/blob/client");

    const jsonResponse = await handleUpload({
      request: req,
      token,

      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/bmp",
          "image/tiff",
          "image/heic",
          "image/heif",
          "application/pdf",
          "application/octet-stream",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        addRandomSuffix: true,
      }),

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
    return res.end(
      JSON.stringify({ error: err?.message || "Blob upload failed" })
    );
  }
};