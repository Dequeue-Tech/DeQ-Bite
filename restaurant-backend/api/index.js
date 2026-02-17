const path = require('path');
const Module = require('module');

const aliasBaseCandidates = [
  path.join(__dirname, '../dist'),
  path.join(__dirname, '../src'),
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), 'src'),
];

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveWithAtAlias(request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith('@/')) {
    const suffix = request.slice(2);
    for (const basePath of aliasBaseCandidates) {
      try {
        return originalResolveFilename.call(this, path.join(basePath, suffix), parent, isMain, options);
      } catch (error) {
        if (!error || error.code !== 'MODULE_NOT_FOUND') {
          throw error;
        }
      }
    }
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

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

const appModule = requireFirst([
  '../dist/app',
  '../dist/src/app',
  '../src/app',
  '../../dist/app',
  '../../dist/src/app',
  '../../src/app',
]);
const dbModule = requireFirst([
  '../dist/config/database',
  '../dist/src/config/database',
  '../src/config/database',
  '../../dist/config/database',
  '../../dist/src/config/database',
  '../../src/config/database',
]);

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
