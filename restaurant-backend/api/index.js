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
// ─────────────────────────────────────────────────────────────────────────────

// Load compiled app and database modules using absolute paths
const appModule  = require(path.join(backendRoot, 'dist', 'app'));
const dbModule   = require(path.join(backendRoot, 'dist', 'config', 'database'));

const app             = appModule.default || appModule;
const connectDatabase = dbModule.connectDatabase;

let dbConnectionPromise = null;

module.exports = async (req, res) => {
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
    res.status(503).json({ error: 'Database unavailable', detail: dbErr.message });
    return;
  }

  return app(req, res);
};
