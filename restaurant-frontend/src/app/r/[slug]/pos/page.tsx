'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function PosRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string | undefined;

  useEffect(() => {
    if (slug) {
      router.replace(`/r/${slug}/menu?pos=1`);
    }
  }, [slug, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-600">Loading POS...</p>
    </div>
  );
}
