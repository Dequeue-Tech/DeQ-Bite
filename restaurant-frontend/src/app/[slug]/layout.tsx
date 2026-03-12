'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export default function RestaurantLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const slug = params?.slug as string | undefined;

  useEffect(() => {
    if (slug) {
      apiClient.setSelectedRestaurantSlug(slug);
    }
  }, [slug]);

  return <>{children}</>;
}
