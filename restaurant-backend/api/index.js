// JavaScript version of the main entry point
console.log('Starting JavaScript version of api/index.js');

// Import environment variables
require('../vercel-env');
console.log('Environment variables loaded in JS version');

// Import serverless-http
const serverless = require('serverless-http');
console.log('serverless-http imported in JS version');

// Import app
console.log('About to import app from ../src/server in JS version');
const app = require('../dist/server').default;
console.log('App imported successfully in JS version');

// Create serverless function
console.log('Creating serverless function in JS version');
const handler = serverless(app, {
  binary: ['*/*'],
});

console.log('Serverless function created in JS version');

// Export
module.exports = handler;
module.exports.config = {
  maxDuration: 5,
  memory: 512,
};

console.log('JS version initialization complete');