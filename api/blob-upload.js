/**
 * /api/blob-upload
 * ---------------------------------------------------------
 * Vercel Blob: Client Upload Route (Node runtime)
 */

module.exports = async (req, res) => {
  // CORS (important for iOS Safari)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const token =
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

  if (!token) {
    // IMPORTANT: still return 200 with JSON
    res.status(200).json({ error: 'Missing blob token' });
    return;
  }

  try {
    const { handleUpload } = await import('@vercel/blob/client');

    const jsonResponse = await handleUpload({
      request: req,
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
        console.log('Blob upload completed:', blob?.url);
      },
    });

    res.status(200).json(jsonResponse);
  } catch (err) {
    console.error('Blob upload route error:', err);

    // DO NOT return 400 — Safari breaks
    res.status(200).json({
      error: err?.message || 'Blob upload failed',
    });
  }
};