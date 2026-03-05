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

const appModule = requireFirst(appPaths);
const dbModule = requireFirst(dbPaths);

const app = appModule.default || appModule;
const connectDatabase = dbModule.connectDatabase;

let dbConnectionPromise;

module.exports = async (req, res) => {
  if (!dbConnectionPromise) {
    dbConnectionPromise = connectDatabase();
  }

  await dbConnectionPromise;
  return app(req, res);
};
