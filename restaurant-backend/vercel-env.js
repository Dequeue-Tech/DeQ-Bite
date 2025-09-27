// This file helps with environment variable handling in Vercel
require('dotenv').config();

// Map Vercel environment variables to our expected variables
if (process.env['VERCEL_URL']) {
  process.env['FRONTEND_URL'] = `https://${process.env['VERCEL_URL']}`;
}

// Ensure required environment variables are set
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn('Warning: Missing required environment variables:', missingEnvVars);
}

module.exports = {};