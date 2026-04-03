'use client';

import { ReactNode, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/Navbar';
import RestaurantContextSync from '@/components/RestaurantContextSync';
import RestaurantStaffGuard from '@/components/RestaurantStaffGuard';

const AUTH_ROUTES_WITHOUT_NAV = new Set(['/auth/signin', '/auth/signup']);

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideNavbars = AUTH_ROUTES_WITHOUT_NAV.has(pathname);

  return (
    <div
      id="root"
      className={`min-h-screen flex flex-col safe-area-pb ${hideNavbars ? '' : 'pb-24 md:pb-0'}`}
    >
      <Suspense fallback={null}>
        <RestaurantContextSync />
      </Suspense>
      <Suspense fallback={null}>
        <RestaurantStaffGuard />
      </Suspense>
      {!hideNavbars && <Navbar />}
      <main className="flex-1">{children}</main>
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
  );
}
