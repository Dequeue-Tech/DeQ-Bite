const path = require('path');
const Module = require('module');

// ─── Fix: ensure node_modules next to this file's package root is on the
// search path BEFORE any require() call. Vercel serverless functions run
// from /var/task/<repoRoot> but node_modules lives at
// /var/task/<repoRoot>/restaurant-backend/node_modules (monorepo) OR at
// /var/task/node_modules when Root Directory is set correctly.
// We add ALL candidate node_modules dirs so it works in both layouts.
const apiDir = path.resolve(__dirname);           // …/api
const backendRoot = path.resolve(apiDir, '..');   // …/restaurant-backend
const repoRoot = path.resolve(backendRoot, '..'); // …/ (repo root)

const nmCandidates = [
  path.join(backendRoot, 'node_modules'),
  path.join(repoRoot, 'node_modules'),
  '/var/task/node_modules',
  '/var/task/restaurant-backend/node_modules',
];

for (const nm of nmCandidates) {
  if (!Module.globalPaths.includes(nm)) {
    Module.globalPaths.push(nm);
  }
}

// Also patch NODE_PATH so child requires inherit the same paths
const existingNodePath = process.env.NODE_PATH || '';
const extraPaths = nmCandidates.join(path.delimiter);
process.env.NODE_PATH = existingNodePath
  ? `${existingNodePath}${path.delimiter}${extraPaths}`
  : extraPaths;
Module._initPaths(); // re-initialise module search paths

const rootDir = backendRoot;

const appPaths = [
  path.join(rootDir, 'dist', 'app'),
  path.join(rootDir, 'dist', 'src', 'app'),
];

const dbPaths = [
  path.join(rootDir, 'dist', 'config', 'database'),
  path.join(rootDir, 'dist', 'src', 'config', 'database'),
];

function requireFirst(paths) {
  const notFoundErrors = [];
  for (const modulePath of paths) {
    try {
      return require(modulePath);
    } catch (error) {
      if (!error || error.code !== 'MODULE_NOT_FOUND') {
        throw error;
      }
      notFoundErrors.push(`${modulePath}: ${error.message}`);
    }
  }
  throw new Error(
    `Unable to load any module from: ${paths.join(', ')}\n${notFoundErrors.join('\n')}`
  );
}

let app;
let connectDatabase;
let initError;

try {
  const appModule = requireFirst(appPaths);
  const dbModule = requireFirst(dbPaths);
  app = appModule.default || appModule;
  connectDatabase = dbModule.connectDatabase;
} catch (err) {
  initError = err;
  console.error('FATAL: Failed to load app modules:', err.message);
}

let dbConnectionPromise;

module.exports = async (req, res) => {
  // If module loading failed, return a clear 500 with the error
  if (initError) {
    console.error('Module load error on request:', initError.message);
    res.status(500).json({
      error: 'Server initialisation failed',
      detail: initError.message,
    });
    return;
  }

  // Connect to DB once per cold start
  if (!dbConnectionPromise) {
    dbConnectionPromise = connectDatabase().catch((err) => {
      // Reset so next request retries
      dbConnectionPromise = null;
      throw err;
    });
  }

  try {
    await dbConnectionPromise;
  } catch (dbErr) {
    console.error('Database connection failed:', dbErr.message);
    res.status(503).json({
      error: 'Database connection failed',
      detail: dbErr.message,
    });
    return;
  }

  return app(req, res);
};
