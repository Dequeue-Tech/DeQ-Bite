require('tsconfig-paths/register');

function requireFirst(paths) {
  for (const modulePath of paths) {
    try {
      return require(modulePath);
    } catch (error) {
      if (!error || error.code !== 'MODULE_NOT_FOUND') {
        throw error;
      }
    }
  }
  throw new Error(`Unable to load any module from: ${paths.join(', ')}`);
}

const appModule = requireFirst(['../dist/app', '../src/app']);
const dbModule = requireFirst(['../dist/config/database', '../src/config/database']);

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
