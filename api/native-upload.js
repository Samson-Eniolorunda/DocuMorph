/**
 * /api/native-upload
 * Native FormData Upload for iOS devices
 * Bypasses @vercel/blob client issues on iOS Safari
 */

module.exports.config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

const Busboy = require("busboy");

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Content-Length");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "Method Not Allowed" }));
  }

  const token =
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

  if (!token) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: "Missing blob token" }));
  }

  try {
    const { put } = await import("@vercel/blob");

    // Parse multipart form data
    const fileData = await parseFormData(req);

    if (!fileData || !fileData.buffer) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "No file uploaded" }));
    }

    console.log(
      "[native-upload] Uploading:",
      fileData.filename,
      fileData.mimetype,
      fileData.buffer.length,
      "bytes",
    );

    // Upload directly to Vercel Blob using server-side put()
    const blob = await put(
      `uploads/${Date.now()}-${fileData.filename}`,
      fileData.buffer,
      {
        access: "public",
        token,
        contentType: fileData.mimetype,
        addRandomSuffix: true,
      },
    );

    console.log("[native-upload] Success:", blob.url);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ url: blob.url, blob }));
  } catch (err) {
    console.error("[native-upload] Error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: err.message || "Upload failed" }));
  }
};

function parseFormData(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let fileInfo = null;
    let completed = false;

    const timeout = setTimeout(() => {
      if (!completed) {
        completed = true;
        reject(new Error("Form parse timeout"));
      }
    }, 60000);

    try {
      const busboy = Busboy({
        headers: req.headers,
        limits: {
          fileSize: 50 * 1024 * 1024, // 50MB
        },
      });

      busboy.on("file", (fieldname, stream, info) => {
        const { filename, mimeType } = info;
        fileInfo = {
          filename: String(filename || "upload.bin").replace(
            /[^a-z0-9_.-]/gi,
            "_",
          ),
          mimetype: mimeType || "application/octet-stream",
        };

        stream.on("data", (chunk) => {
          chunks.push(chunk);
        });

        stream.on("end", () => {
          // File stream complete
        });

        stream.on("error", (err) => {
          if (!completed) {
            completed = true;
            clearTimeout(timeout);
            reject(err);
          }
        });
      });

      busboy.on("finish", () => {
        if (!completed) {
          completed = true;
          clearTimeout(timeout);
          if (fileInfo && chunks.length > 0) {
            fileInfo.buffer = Buffer.concat(chunks);
            resolve(fileInfo);
          } else {
            resolve(null);
          }
        }
      });

      busboy.on("error", (err) => {
        if (!completed) {
          completed = true;
          clearTimeout(timeout);
          reject(err);
        }
      });

      req.pipe(busboy);
    } catch (err) {
      completed = true;
      clearTimeout(timeout);
      reject(err);
    }
  });
}
