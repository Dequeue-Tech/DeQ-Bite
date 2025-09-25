import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'Restaurant Online Ordering',
  description: 'Order delicious food online from our restaurant with secure payment and table delivery',
  keywords: ['restaurant', 'food', 'online ordering', 'delivery', 'takeout'],
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
      <body>
        <div id="root">
          <Navbar />
          {children}
          <Toaster />
        </div>
      </body>
    </html>
  )
}