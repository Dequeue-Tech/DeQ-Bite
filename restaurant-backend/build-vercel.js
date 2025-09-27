const { build } = require('esbuild');
const { resolve } = require('path');

// Build configuration for Vercel deployment
build({
  entryPoints: ['api/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: '.vercel_build_output/functions/api/index.js',
  external: [
    '@prisma/client',
    'bcryptjs',
    'jsonwebtoken',
    'nodemailer',
    'razorpay',
    'twilio',
    'winston',
    'zod'
  ],
  format: 'cjs',
  sourcemap: true,
  minify: false,
  define: {
    'process.env.NODE_ENV': '"production"'
  }
}).catch(() => process.exit(1));