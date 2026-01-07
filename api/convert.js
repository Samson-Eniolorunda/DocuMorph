/**
 * /api/convert (Vercel Serverless Function - Node runtime)
 * ---------------------------------------------------------
 * Purpose:
 * - Proxy requests to ConvertAPI WITHOUT exposing your secret in the browser.
 * - Supports TWO modes:
 *   1) URL mode (recommended): Browser uploads to Vercel Blob, then sends file URL(s) here.
 *      This avoids serverless upload limits + reduces WAF/403 triggers.
 *   2) Multipart mode (legacy): Browser sends multipart/form-data and we stream it to ConvertAPI.
 *
 * Frontend calls:
 *   POST /api/convert?type=<convertapi-route>
 *
 * Env required:
 *   CONVERTAPI_SECRET
 */

const https = require('https');

// Keep Next/Vercel from parsing the body so we can stream multipart when needed.
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

function isValidConvertType(type) {
  // Examples: docx/to/pdf, pdf/to/docx, jpg/to/png, xlsx/to/pdf, pdf/to/merge, pdf/to/compress
  return /^[a-z0-9-]+\/to\/[a-z0-9-]+$/i.test(type);
}

function readRawBody(req, maxBytes = 2 * 1024 * 1024) {
  // URL-mode JSON body is small. Keep this strict.
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8') || ''));
    req.on('error', reject);
  });
}

function forwardToConvertApi({ type, secret, queryParams = {}, headers = {} }, res) {
  const base = new URL(`https://v2.convertapi.com/convert/${type}`);
  base.searchParams.set('Secret', secret);

  // Add all query params
  Object.entries(queryParams).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    base.searchParams.set(k, String(v));
  });

  const proxyReq = https.request(
    {
      method: 'POST',
      hostname: base.hostname,
      path: base.pathname + base.search,
      headers: {
        'user-agent': 'DocuMorph-Proxy/2.0',
        ...headers,
      },
      timeout: 120000,
    },
    (proxyRes) => {
      res.statusCode = proxyRes.statusCode || 502;
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json');
      if (proxyRes.headers['x-request-id']) res.setHeader('x-request-id', proxyRes.headers['x-request-id']);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('timeout', () => proxyReq.destroy(new Error('Proxy timeout')));

  proxyReq.on('error', (err) => {
    console.error('ConvertAPI proxy error:', err);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'text/plain');
    }
    res.end('Bad Gateway');
  });

  // No body needed for URL-mode requests (everything in query)
  proxyReq.end();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end('Method Not Allowed');
  }

  const secret = process.env.CONVERTAPI_SECRET;
  const type = req.query?.type ? String(req.query.type).trim() : '';

  if (!secret) return res.status(500).end('Missing CONVERTAPI_SECRET');
  if (!type) return res.status(400).end('Missing type query param');
  if (!isValidConvertType(type)) return res.status(400).end('Invalid type format. Expected like: docx/to/pdf');

  const contentType = String(req.headers['content-type'] || '').toLowerCase();

  // =========================================================
  // MODE 1 (RECOMMENDED): JSON body + file URL(s)
  // =========================================================
  if (contentType.includes('application/json')) {
    try {
      const raw = await readRawBody(req);
      const data = raw ? JSON.parse(raw) : {};

      const storeFile = data?.storeFile === false ? 'false' : 'true';
      const params = data?.params && typeof data.params === 'object' ? data.params : {};

      const queryParams = {
        StoreFile: storeFile,
      };

      // Single file tools
      if (data?.fileUrl) {
        queryParams.File = String(data.fileUrl);
      }

      // Merge tools (multiple files)
      if (Array.isArray(data?.files) && data.files.length) {
        data.files.forEach((url, i) => {
          queryParams[`Files[${i}]`] = String(url);
        });
      }

      // Extra ConvertAPI params (Preset, Quality, ImageWidth, ImageHeight, ...)
      Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') return;
        queryParams[k] = String(v);
      });

      return forwardToConvertApi({ type, secret, queryParams }, res);
    } catch (err) {
      console.error('Convert URL-mode error:', err);
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      return res.end('Invalid JSON payload');
    }
  }

  // =========================================================
  // MODE 2 (LEGACY): multipart/form-data streaming
  // =========================================================
  // NOTE: This can still trigger WAF/403 on some mobile networks/devices.
  const targetUrl = new URL(`https://v2.convertapi.com/convert/${type}?Secret=${encodeURIComponent(secret)}`);

  const headers = {
    'content-type': req.headers['content-type'] || 'application/octet-stream',
    'user-agent': 'DocuMorph-Proxy/2.0',
  };

  // Only forward content-length if present
  if (req.headers['content-length']) {
    headers['content-length'] = req.headers['content-length'];
  }

  const proxyReq = https.request(
    {
      method: 'POST',
      hostname: targetUrl.hostname,
      path: targetUrl.pathname + targetUrl.search,
      headers,
      timeout: 120000,
    },
    (proxyRes) => {
      res.statusCode = proxyRes.statusCode || 502;
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json');
      if (proxyRes.headers['x-request-id']) res.setHeader('x-request-id', proxyRes.headers['x-request-id']);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('timeout', () => proxyReq.destroy(new Error('Proxy timeout')));

  proxyReq.on('error', (err) => {
    console.error('Convert multipart proxy error:', err);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'text/plain');
    }
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
};
