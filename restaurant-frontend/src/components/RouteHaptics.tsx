'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { triggerHaptic } from '@/lib/haptics';

export default function RouteHaptics() {
  const pathname = usePathname();
  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    triggerHaptic('navigation');
  }, [pathname]);

  return null;
}
