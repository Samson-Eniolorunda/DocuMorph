/**
 * /api/blob-upload
 * ---------------------------------------------------------
 * Vercel Blob: Client Upload Route (Node runtime)
 *
 * Why this exists:
 * - Lets the browser upload files DIRECTLY to Vercel Blob (no serverless body-size limit)
 * - Avoids WAF/403 issues that can happen when uploading big phone photos through /api/*
 *
 * Frontend uses:
 *   upload(pathname, file, { handleUploadUrl: '/api/blob-upload' })
 * from @vercel/blob/client (loaded via esm.sh in scripts.js).
 */

const MAX_BYTES = 50 * 1024 * 1024; // 50MB

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end('Method Not Allowed');
  }

  try {
    // Read JSON body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8') || '{}';
    const body = JSON.parse(raw);

    // Dynamic import (package is ESM-friendly; keeps this file CommonJS)
    const { handleUpload } = await import('@vercel/blob/client');

    // Rebuild a WHATWG Request (Node 18+ provides Request globally)
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const url = `${proto}://${host}${req.url}`;

    const request = new Request(url, {
      method: 'POST',
      headers: req.headers,
    });

    const response = await handleUpload({
      request,
      body,

      // Runs before the token is generated (good place for size/type restrictions)
      onBeforeGenerateToken: async (_pathname, _clientPayload) => {
        return {
          maximumSizeInBytes: MAX_BYTES,
          // Keep this list aligned with what your UI accepts
          allowedContentTypes: [
            'image/*',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ],
          addRandomSuffix: true,
        };
      },

      // Optional callback after upload completes (fires from Vercel)
      onUploadCompleted: async ({ blob }) => {
        console.log('Blob upload completed:', blob?.url);
      },
    });

    // Forward the Response back to the browser
    res.statusCode = response.status;
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.setHeader('Cache-Control', 'no-store');

    const text = await response.text();
    return res.end(text);
  } catch (err) {
    console.error('Blob upload route error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('Blob upload route failed');
  }
};
