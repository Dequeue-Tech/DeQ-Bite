/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // allow all HTTPS domains
      },
    ],
    unoptimized: true, // Disable image optimization for Vercel
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  // Output file tracing root to fix warning
  outputFileTracingRoot: __dirname,
  // Vercel specific configuration
  trailingSlash: false,
  // Optimize for Vercel's platform
  poweredByHeader: false,
  // Enable static optimization where possible
  experimental: {
    appDir: true,
    fontLoaders: [
      { loader: '@next/font/google', options: { subsets: ['latin'] } }
    ],
  },
}

// Export the config for Vercel deployment
module.exports = nextConfig