'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiClient, RestaurantMembership } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';

const STAFF_ROLES = new Set(['OWNER', 'ADMIN', 'STAFF', 'KITCHEN_STAFF']);

const BLOCKED_ROOT_SEGMENTS = new Set([
  '',
  'auth',
  'onboarding',
  'admin',
  'central-admin',
  'kitchen',
  'cart',
  'checkout',
  'menu',
  'orders',
  'pos',
  'api',
  '_next',
  'favicon.ico',
  'restaurants',
]);

const getRootSegment = (pathname: string | null) => {
  if (!pathname) return '';
  return pathname.split('/').filter(Boolean)[0] || '';
};

const getSlugFromPathname = (pathname: string | null) => {
  const first = getRootSegment(pathname);
  if (!first || BLOCKED_ROOT_SEGMENTS.has(first)) return null;
  if (first.includes('.')) return null;
  return first.toLowerCase();
};

const toIdentifierSet = (restaurants: RestaurantMembership[]) => {
  const set = new Set<string>();
  restaurants.forEach((entry) => {
    if (entry.id) set.add(entry.id.toLowerCase());
    if (entry.slug) set.add(entry.slug.toLowerCase());
    if (entry.subdomain) set.add(entry.subdomain.toLowerCase());
  });
  return set;
};

const pickPreferredSlug = (restaurants: RestaurantMembership[], selectedSlug: string | null) => {
  const allowed = toIdentifierSet(restaurants);
  if (selectedSlug && allowed.has(selectedSlug.toLowerCase())) return selectedSlug.toLowerCase();
  const first = restaurants[0];
  const candidate = first?.slug || first?.subdomain || first?.id || '';
  return candidate ? candidate.toLowerCase() : null;
};

const isPublicRestaurantsPath = (pathname: string | null) => {
  if (!pathname) return false;
  return pathname === '/' || pathname === '/restaurants' || pathname.startsWith('/restaurants/');
};

const getRestaurantsIdentifier = (pathname: string | null) => {
  if (!pathname) return null;
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'restaurants') return null;
  return parts[1] ? parts[1].toLowerCase() : null;
};

export default function RestaurantStaffGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuthStore();
  const [memberships, setMemberships] = useState<RestaurantMembership[]>([]);
  const [loading, setLoading] = useState(false);

  const isStaffUser =
    (!!user?.role && STAFF_ROLES.has(user.role)) ||
    (!!user?.restaurantRole && STAFF_ROLES.has(user.restaurantRole));

  useEffect(() => {
    let isActive = true;
    if (!isAuthenticated || !isStaffUser) return;

    setLoading(true);
    apiClient
      .getMyRestaurants()
      .then((restaurants) => {
        if (!isActive) return;
        setMemberships(restaurants);
      })
      .catch(() => {
        if (!isActive) return;
        setMemberships([]);
      })
      .finally(() => {
        if (!isActive) return;
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, isStaffUser]);

  const allowedIdentifiers = useMemo(() => toIdentifierSet(memberships), [memberships]);

  useEffect(() => {
    if (!isAuthenticated || !isStaffUser || loading) return;

    const selectedSlug = apiClient.getSelectedRestaurantSlug();
    const preferredSlug = pickPreferredSlug(memberships, selectedSlug);
    if (preferredSlug) {
      if (!selectedSlug || !allowedIdentifiers.has(selectedSlug.toLowerCase())) {
        apiClient.setSelectedRestaurantSlug(preferredSlug);
      }
    }

    if (!preferredSlug) return;

    const pathSlug = getSlugFromPathname(pathname);
    const restaurantsPath = isPublicRestaurantsPath(pathname);

    if (restaurantsPath) {
      const identifier = getRestaurantsIdentifier(pathname);
      if (identifier && allowedIdentifiers.has(identifier)) {
        return;
      }
      const destination =
        user?.role === 'STAFF' || user?.role === 'KITCHEN_STAFF'
          ? '/kitchen'
          : `/${preferredSlug}/admin`;

      if (pathname !== destination) {
        router.replace(destination);
      }
      return;
    }

    if (pathSlug && !allowedIdentifiers.has(pathSlug)) {
      const destination =
        user?.role === 'STAFF' || user?.role === 'KITCHEN_STAFF'
          ? '/kitchen'
          : `/${preferredSlug}/admin`;

      if (pathname !== destination) {
        router.replace(destination);
      }
    }
  }, [allowedIdentifiers, isAuthenticated, isStaffUser, loading, memberships, pathname, router, user?.role]);

  return null;
}
