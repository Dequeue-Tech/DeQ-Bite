const path = require('path');

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

// Try multiple path strategies to handle different deployment environments
const apiDir = __dirname;
const rootDir = path.join(apiDir, '..');

const appPaths = [
  path.join(rootDir, 'dist', 'app'),
  path.join(rootDir, 'dist', 'src', 'app'),
  '../dist/app',
  '../dist/src/app',
];

const dbPaths = [
  path.join(rootDir, 'dist', 'config', 'database'),
  path.join(rootDir, 'dist', 'src', 'config', 'database'),
  '../dist/config/database',
  '../dist/src/config/database',
];

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
