/**
 * /api/blob-upload
 * Vercel Blob: Client Upload Route (Node runtime)
 */
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB

module.exports.config = {
  api: {
    bodyParser: false, // We try to disable it, but we will check anyway
  },
};

async function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  // 1. SAFETY CHECK: If Vercel already parsed the body, use it!
  if (req.body) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }

  // 2. If not, read the raw stream manually
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      throw new Error("Request body too large");
    }
    chunks.push(buf);
  }

  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  try {
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

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
    return res.end(JSON.stringify({ error: "Method Not Allowed" }));
  }

  // TOKEN CHECK
  const token =
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

  if (!token) {
    console.error("SERVER ERROR: No Token Found");
    res.statusCode = 200;
    return res.end(
      JSON.stringify({ error: "Missing blob token (Server Misconfigured)" }),
    );
  }

  try {
    const { handleUpload } = await import("@vercel/blob/client");
    const body = await readJsonBody(req);

    // DEBUG LOG: See exactly what we received
    console.log("DEBUG BODY:", body);

    const jsonResponse = await handleUpload({
      body,
      token,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "image/jpeg",
          "image/png",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        addRandomSuffix: true,
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log("Upload success:", blob.url);
      },
    });

    res.statusCode = 200;
    return res.end(JSON.stringify(jsonResponse));
  } catch (err) {
    console.error("HANDLE UPLOAD ERROR:", err);
    res.statusCode = 200;
    return res.end(JSON.stringify({ error: err.message || "Unknown Error" }));
  }
};
