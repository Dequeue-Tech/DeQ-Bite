'use strict';
const path = require('path');

// Vercel deploys the function at /var/task/<file>.
// __dirname here is always the absolute dir of THIS file (api/).
// The project root (restaurant-backend/) is one level up.
const backendRoot = path.resolve(__dirname, '..');

// ─── Inject node_modules paths BEFORE any other require() ───────────────────
// This is required when Vercel does not install under the same prefix as
// the compiled JS lives in (happens in monorepo layouts).
const Module = require('module');
const nodeModulesDirs = [
  path.join(backendRoot, 'node_modules'),          // normal / root-dir layout
  path.resolve('/var/task/node_modules'),           // vercel managed install
  path.resolve('/var/task/restaurant-backend/node_modules'), // monorepo layout
];
for (const dir of nodeModulesDirs) {
  if (!Module.globalPaths.includes(dir)) Module.globalPaths.unshift(dir);
}
const existing = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];
for (const dir of nodeModulesDirs) {
  if (!existing.includes(dir)) existing.push(dir);
}
process.env.NODE_PATH = existing.join(path.delimiter);
Module._initPaths();

// Resolve TS path alias imports (e.g. "@/middleware/errorHandler") from compiled dist files.
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith('@/')) {
    request = path.join(backendRoot, 'dist', request.slice(2));
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
// ─────────────────────────────────────────────────────────────────────────────

// Load compiled app and database modules using absolute paths
const appModule  = require(path.join(backendRoot, 'dist', 'app'));
const dbModule   = require(path.join(backendRoot, 'dist', 'config', 'database'));

const app             = appModule.default || appModule;
const connectDatabase = dbModule.connectDatabase;

let dbConnectionPromise = null;

const CORS_ALLOWED_HEADERS = 'Content-Type, Authorization, x-api-key, x-restaurant-subdomain, x-restaurant-slug, idempotency-key, x-expected-updated-at';
const CORS_ALLOWED_METHODS = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';

const normalizeOriginHeader = (originHeader) => {
  if (typeof originHeader === 'string') return originHeader.trim();
  if (Array.isArray(originHeader) && originHeader.length > 0) return String(originHeader[0]).trim();
  return '';
};

const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();

    const isLocalDevHost =
      (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') &&
      (parsed.protocol === 'http:' || parsed.protocol === 'https:');
    const isAllowedVercelFrontend =
      parsed.protocol === 'https:' &&
      (hostname === 'de-q-restaurants-frontend.vercel.app' || hostname.startsWith('de-q-restaurants-frontend-')) &&
      hostname.endsWith('.vercel.app');
    const isAllowedDequeueDomain =
      parsed.protocol === 'https:' &&
      (hostname === 'dequeue.co.in' || hostname.endsWith('.dequeue.co.in'));

    return isLocalDevHost || isAllowedVercelFrontend || isAllowedDequeueDomain;
  } catch {
    return false;
  }
};

const applyCorsHeaders = (req, res) => {
  const origin = normalizeOriginHeader(req?.headers?.origin);
  if (!isAllowedOrigin(origin)) return false;

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS);
  res.setHeader('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);
  res.setHeader('Vary', 'Origin');
  return true;
};

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    applyCorsHeaders(req, res);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!dbConnectionPromise) {
    dbConnectionPromise = connectDatabase().catch((err) => {
      dbConnectionPromise = null; // reset so next cold-start retries
      return Promise.reject(err);
    });
  }

  try {
    await dbConnectionPromise;
  } catch (dbErr) {
    console.error('[api/index] DB connection failed:', dbErr.message);
    applyCorsHeaders(req, res);
    res.status(503).json({ error: 'Database unavailable', detail: dbErr.message });
    return;
  }

  return app(req, res);
};
