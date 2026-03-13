'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const BLOCKED_ROOT_SEGMENTS = new Set([
  '',
  'auth',
  'onboarding',
  'restaurants',
  'admin',
  'central-admin',
  'cart',
  'checkout',
  'kitchen',
  'menu',
  'orders',
  'pos',
  'api',
  '_next',
  'favicon.ico',
]);

function getSlugFromPathname(pathname: string | null): string | null {
  if (!pathname) return null;
  const first = pathname.split('/').filter(Boolean)[0] || '';
  if (!first || BLOCKED_ROOT_SEGMENTS.has(first)) return null;
  if (first.includes('.')) return null;
  return first.toLowerCase();
}

export default function RestaurantContextSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const slug = getSlugFromPathname(pathname);
    if (slug) {
      apiClient.setSelectedRestaurantSlug(slug);
    }
  }, [pathname]);

  useEffect(() => {
    const tableParam = searchParams?.get('table');
    if (tableParam) {
      apiClient.setSelectedTableNumber(tableParam);
    }
  }, [searchParams]);

  return null;
}
