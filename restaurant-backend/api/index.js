const appModule = require('../dist/app');
const dbModule = require('../dist/config/database');

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
