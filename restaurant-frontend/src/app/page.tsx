'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';
import { RestaurantCardProps } from './_components/RestaurantCard';

const RestaurantGrid = dynamic(() => import('./_components/RestaurantGrid'), {
  loading: () => <RestaurantGridSkeleton />,
});

const RESTAURANTS_CACHE_KEY = 'restaurants_cache_v1';
const RESTAURANTS_CACHE_TTL_MS = 2 * 60 * 1000;

function RestaurantGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
      {[0, 1, 2, 3].map((card) => (
        <div
          key={card}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse"
        >
          <div className="w-full aspect-[16/9] bg-gray-200" />
          <div className="p-4 space-y-3">
            <div className="h-4 w-3/4 bg-gray-200 rounded" />
            <div className="h-3 w-full bg-gray-200 rounded" />
            <div className="h-3 w-5/6 bg-gray-200 rounded" />
            <div className="h-3 w-2/5 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8 sm:mb-10">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="h-4 w-72 bg-gray-200 rounded animate-pulse" />
        </div>
        <RestaurantGridSkeleton />
      </div>
    </div>
  );
}

async function getRestaurants(): Promise<RestaurantCardProps[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  try {
    const response = await fetch(`${apiBase}/restaurants/public/search`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      success?: boolean;
      data?: {
        restaurants?: Array<{
          id: string;
          name: string;
          slug?: string;
          subdomain?: string;
          address?: string | null;
          logoUrl?: string | null;
          rating?: number | null;
          status?: string;
        }>;
      };
    };

    const restaurants = payload.data?.restaurants ?? [];

    return restaurants.map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug || restaurant.subdomain || restaurant.id,
      address: restaurant.address ?? null,
      logoUrl: restaurant.logoUrl ?? null,
      rating: typeof restaurant.rating === 'number' ? restaurant.rating : undefined,
      priceForTwo: 80000, // Default 800 INR in paise
      status: restaurant.status,
    }));
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    return [];
  }
}

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, user, getProfile } = useAuthStore();
  const [restaurants, setRestaurants] = useState<RestaurantCardProps[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated && user && typeof user.restaurantRole === 'undefined') {
      getProfile();
    }
  }, [isAuthenticated, user, getProfile]);

  useEffect(() => {
    const hasAdminAccess =
      user?.role === 'OWNER' ||
      user?.role === 'ADMIN' ||
      user?.restaurantRole === 'OWNER' ||
      user?.restaurantRole === 'ADMIN';

    if (!isAuthenticated || !hasAdminAccess) return;

    const redirectToAdmin = async () => {
      const selectedSlug = apiClient.getSelectedRestaurantSlug();
      if (selectedSlug) {
        router.replace(`/${selectedSlug}/admin`);
        return;
      }

      try {
        const restaurants = await apiClient.getMyRestaurants();
        const adminRestaurant = restaurants.find(
          (r) => r.role === 'OWNER' || r.role === 'ADMIN'
        );
        const slug = adminRestaurant?.slug || adminRestaurant?.subdomain || adminRestaurant?.id;
        if (slug) {
          apiClient.setSelectedRestaurantSlug(slug);
          router.replace(`/${slug}/admin`);
        }
      } catch {
        // ignore errors while trying to resolve admin restaurant
      }
    };

    redirectToAdmin();
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    let isActive = true;

    const cacheRaw = sessionStorage.getItem(RESTAURANTS_CACHE_KEY);
    const cacheTsRaw = sessionStorage.getItem(`${RESTAURANTS_CACHE_KEY}_ts`);
    const cacheTs = cacheTsRaw ? Number(cacheTsRaw) : 0;

    if (cacheRaw && cacheTs && Date.now() - cacheTs < RESTAURANTS_CACHE_TTL_MS) {
      try {
        const cached = JSON.parse(cacheRaw);
        if (Array.isArray(cached)) {
          setRestaurants(cached as RestaurantCardProps[]);
          setLoading(false);
        }
      } catch {
        // ignore cache parse errors
      }
    }

    getRestaurants().then((data) => {
      if (!isActive) return;
      setRestaurants(data);
      setLoading(false);
      try {
        sessionStorage.setItem(RESTAURANTS_CACHE_KEY, JSON.stringify(data));
        sessionStorage.setItem(`${RESTAURANTS_CACHE_KEY}_ts`, String(Date.now()));
      } catch {
        // ignore cache write errors
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  if (loading) {
    return <HomePageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header Section */}
        <div className="mb-8 sm:mb-10 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
            Choose Your Restaurant
          </h1>
          <p className="text-base sm:text-lg text-gray-600 mt-2">
            Select a restaurant to view menus and place orders
          </p>
        </div>

        {/* Restaurant Grid */}
        <RestaurantGrid restaurants={restaurants} />
      </div>
    </div>
  );
}
