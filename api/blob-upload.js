/**
 * /api/blob-upload
 * Vercel Blob: Client Upload Route (Node runtime)
 *
 * This version:
 * - Reads the (small) JSON body the client sends and passes body to handleUpload().
 * - Avoids consuming any file stream (the file upload itself is done by the client -> blob service).
 * - Always returns HTTP 200 JSON (Safari-friendly). Check server logs for real errors.
 */

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB - safe for the small JSON the client sends

async function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      throw new Error('Request body too large');
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8') || '{}';
  try {
    return JSON.parse(raw);
  } catch (err) {
    // malformed JSON -> return empty object (client.mjs should send valid JSON)
    return {};
  }
}

module.exports = async (req, res) => {
  // Simple CORS for iOS Safari & other browsers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  // prefer BLOB_READ_WRITE_TOKEN but allow VERCEL_BLOB_READ_WRITE_TOKEN
  const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

  if (!token) {
    console.error('Missing blob token env var (BLOB_READ_WRITE_TOKEN / VERCEL_BLOB_READ_WRITE_TOKEN)');
    // Return 200 JSON — Safari/client code expects JSON; keep client from hard-failing
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing blob token (server misconfigured)' }));
  }

  try {
    // Import handleUpload (Node runtime)
    const { handleUpload } = await import('@vercel/blob/client');

    // Read the small JSON body the client sends (contentLength, name, etc.)
    // Important: we DO NOT read any file stream here — the client first requests a token via JSON.
    const body = await readJsonBody(req);

    // Diagnostic log for debugging (will appear in Vercel function logs)
    console.log('[blob-upload] request body preview:', {
      name: body?.name,
      contentLength: body?.contentLength,
      multipart: body?.multipart,
    });

    const jsonResponse = await handleUpload({
      // pass body explicitly — reliable across environments and avoids stream issues
      body,
      token,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/bmp',
          'image/tiff',
          'image/heic',
          'image/heif',
          'application/pdf',
          'application/octet-stream',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        addRandomSuffix: true,
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log('[blob-upload] Upload completed:', blob?.url);
      },
    });

    // Normal success response (200 JSON) — client expects JSON
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    // Do NOT cache
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify(jsonResponse));
  } catch (err) {
    // Log full error server-side for debugging
    console.error('[blob-upload] handleUpload error:', err && err.stack ? err.stack : err);
    // Return 200 JSON with error field so client receives a parseable response (Safari-safe)
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: String(err?.message || err || 'unknown') }));
  }
};