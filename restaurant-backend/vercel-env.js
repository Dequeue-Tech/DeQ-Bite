// This file helps with environment variable handling in Vercel
console.log('Loading environment variables...');
require('dotenv').config();
console.log('Environment variables loaded');

// Map Vercel environment variables to our expected variables
if (process.env['VERCEL_URL']) {
  process.env['FRONTEND_URL'] = `https://${process.env['VERCEL_URL']}`;
  console.log('Set FRONTEND_URL from VERCEL_URL:', process.env['FRONTEND_URL']);
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
    console.log(`Missing environment variable: ${envVar}`);
  }
  return isMissing;
});

if (missingEnvVars.length > 0) {
  console.warn('Warning: Missing required environment variables:', missingEnvVars);
} else {
  console.log('All required environment variables are present');
}

// Log some key variables for debugging (without sensitive data)
console.log('VERCEL environment:', process.env['VERCEL'] || 'Not set');
console.log('NODE_ENV:', process.env['NODE_ENV'] || 'Not set');

module.exports = {};