/**
 * /api/convert (Vercel Serverless Function - Node runtime)
 * ---------------------------------------------------------
 * Purpose:
 * - Proxy requests to ConvertAPI WITHOUT exposing your secret in the browser.
 * - Supports TWO modes:
 *   1) URL mode (recommended): Browser uploads to Vercel Blob, then sends file URL(s) here.
 *   2) Multipart mode (legacy): Browser sends multipart/form-data and we stream it to ConvertAPI.
 *
 * Frontend calls:
 *   POST /api/convert?type=<convertapi-route>
 *
 * Env required:
 *   CONVERTAPI_SECRET
 */

const https = require('https');

module.exports.config = {
  api: {
    bodyParser: false,
  },
};

function isValidConvertType(type) {
  return /^[a-z0-9-]+\/to\/[a-z0-9-]+$/i.test(type);
}

function readRawBody(req, maxBytes = 2 * 1024 * 1024) {
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

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8') || '');
    });

    req.on('error', reject);
  });
}

function forwardToConvertApi({ type, secret, queryParams = {}, headers = {} }, res) {
  const base = new URL(`https://v2.convertapi.com/convert/${type}`);
  base.searchParams.set('Secret', secret);

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
      res.setHeader(
        'Content-Type',
        proxyRes.headers['content-type'] || 'application/json'
      );
      if (proxyRes.headers['x-request-id']) {
        res.setHeader('x-request-id', proxyRes.headers['x-request-id']);
      }
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('timeout', () => proxyReq.destroy(new Error('Proxy timeout')));

  proxyReq.on('error', () => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'text/plain');
    }
    res.end('Bad Gateway');
  });

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
  if (!isValidConvertType(type)) {
    return res.status(400).end('Invalid type format. Expected: docx/to/pdf');
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase();

  // =========================================================
  // MODE 1: JSON + file URL(s)
  // =========================================================
  if (contentType.includes('application/json')) {
    try {
      const raw = await readRawBody(req);
      const data = raw ? JSON.parse(raw) : {};

      const queryParams = {
        StoreFile: data?.storeFile === false ? 'false' : 'true',
      };

      // Single file
      if (data?.fileUrl) {
        queryParams.File = String(data.fileUrl);
      }

      // Multiple files (merge)
      if (Array.isArray(data?.files)) {
        data.files.forEach((url, i) => {
          queryParams[`Files[${i}]`] = String(url);
        });
      }

      // Extra params
      if (data?.params && typeof data.params === 'object') {
        Object.entries(data.params).forEach(([k, v]) => {
          if (v === undefined || v === null || v === '') return;
          queryParams[k] = String(v);
        });
      }

      return forwardToConvertApi({ type, secret, queryParams }, res);
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      return res.end('Invalid JSON payload');
    }
  }

  // =========================================================
  // MODE 2: multipart/form-data (legacy)
  // =========================================================
  const targetUrl = new URL(
    `https://v2.convertapi.com/convert/${type}?Secret=${encodeURIComponent(secret)}`
  );

  const headers = {
    'content-type': req.headers['content-type'] || 'application/octet-stream',
    'user-agent': 'DocuMorph-Proxy/2.0',
  };

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
      res.setHeader(
        'Content-Type',
        proxyRes.headers['content-type'] || 'application/json'
      );
      if (proxyRes.headers['x-request-id']) {
        res.setHeader('x-request-id', proxyRes.headers['x-request-id']);
      }
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('timeout', () => proxyReq.destroy(new Error('Proxy timeout')));

  proxyReq.on('error', () => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'text/plain');
    }
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
};
