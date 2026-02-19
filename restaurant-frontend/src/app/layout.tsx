import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'Restaurant Online Ordering',
  description: 'Order delicious food online from our restaurant with secure payment and table delivery',
  keywords: ['restaurant', 'food', 'online ordering', 'delivery', 'takeout'],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ea580c',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
      </head>
      <body className="antialiased">
        <div id="root" className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <Toaster 
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                maxWidth: '90vw',
                fontSize: '14px',
              },
            }}
          />
        </div>
      </body>
    </html>
  )
}