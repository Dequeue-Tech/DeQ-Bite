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
  '../../dist/app',
  '../../dist/src/app',
]);
const dbModule = requireFirst([
  '../dist/config/database',
  '../dist/src/config/database',
  '../../dist/config/database',
  '../../dist/src/config/database',
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
