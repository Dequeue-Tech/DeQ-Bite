// This file helps with environment variable handling in Vercel
console.log('vercel-env.js: Starting environment variable loading at:', new Date().toISOString());
require('dotenv').config();
console.log('vercel-env.js: Environment variables loaded at:', new Date().toISOString());

// Map Vercel environment variables to our expected variables
if (process.env['VERCEL_URL']) {
  process.env['FRONTEND_URL'] = `https://${process.env['VERCEL_URL']}`;
  console.log('vercel-env.js: Set FRONTEND_URL from VERCEL_URL:', process.env['FRONTEND_URL']);
}

// Ensure required environment variables are set
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => {
  const isMissing = !process.env[envVar];
  if (isMissing) {
    console.log('vercel-env.js: Missing environment variable:', envVar);
  }
  return isMissing;
});

if (missingEnvVars.length > 0) {
  console.warn('vercel-env.js: Warning: Missing required environment variables:', missingEnvVars);
} else {
  console.log('vercel-env.js: All required environment variables are present');
}

// Log some key variables for debugging (without sensitive data)
console.log('vercel-env.js: VERCEL environment:', process.env['VERCEL'] || 'Not set');
console.log('vercel-env.js: NODE_ENV:', process.env['NODE_ENV'] || 'Not set');

console.log('vercel-env.js: Environment variable loading complete at:', new Date().toISOString());

module.exports = {};