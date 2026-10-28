// Central CORS allow-list shared by Express middleware and the serverless entry.

const DEFAULT_ORIGINS = [
  'https://fortiswallet.vercel.app',
  'https://fortiswallet.online',
  'https://www.fortiswallet.online',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5001',
];

function getAllowedOrigins() {
  const list = [...DEFAULT_ORIGINS];
  if (process.env.CLIENT_URL) {
    process.env.CLIENT_URL.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((o) => {
        if (!list.includes(o)) list.push(o);
      });
  }
  return list;
}

function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin, curl, server-to-server — always allow
  return getAllowedOrigins().includes(origin);
}

/**
 * Set CORS headers directly on a raw Node response.
 * Used inside api/index.js BEFORE any async init so preflight never waits on MongoDB.
 */
function applyCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, Origin'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
}

module.exports = { getAllowedOrigins, isAllowedOrigin, applyCorsHeaders };