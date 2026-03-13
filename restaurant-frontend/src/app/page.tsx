'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Star } from 'lucide-react';
import toast from 'react-hot-toast';

export type RestaurantCardProps = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  logoUrl: string | null;
  rating?: number;
  priceForTwo?: number;
  status?: string;
};

function RestaurantCard({ restaurant }: { restaurant: RestaurantCardProps }) {
  const handleClick = () => {
    try {
      localStorage.setItem('selectedRestaurantSlug', restaurant.slug);
    } catch {}
  };

  return (
    <Link href={`/${restaurant.slug}`} onClick={handleClick}>
      <motion.div
        whileHover={{ y: -5 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl overflow-hidden cursor-pointer h-full flex flex-col"
      >
        {/* Image Section */}
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          {restaurant.logoUrl ? (
            <Image
              src={restaurant.logoUrl}
              alt={restaurant.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
              <span className="text-4xl font-black text-orange-300">
                {restaurant.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          
          {/* Glassmorphism Badge */}
          {restaurant.status && (
            <div className="absolute top-3 right-3 backdrop-blur-md bg-white/30 px-3 py-1 rounded-full border border-white/40 shadow-sm">
              <span className="text-xs font-semibold text-gray-800">
                {restaurant.status === 'APPROVED' ? 'Open' : 'Featured'}
              </span>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-4 flex-1 flex flex-col">
          <h2 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1">
            {restaurant.name}
          </h2>
          
          {restaurant.address && (
            <div className="flex items-center gap-1.5 text-gray-500 mb-3">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <p className="text-sm truncate line-clamp-2">{restaurant.address}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Price for two</span>
              <span className="text-sm font-semibold text-gray-700">
                ₹{(restaurant.priceForTwo || 800) / 100}
              </span>
            </div>
            
            {restaurant.rating && (
              <div className="flex items-center gap-1 bg-orange-50 px-2 py-1 rounded-full">
                <Star className="h-3 w-3 fill-orange-500 text-orange-500" />
                <span className="text-xs font-bold text-orange-700">
                  {restaurant.rating.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
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
  const [restaurants, setRestaurants] = useState<RestaurantCardProps[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRestaurants().then((data) => {
      setRestaurants(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-orange-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading restaurants...</p>
        </div>
      </div>
    );
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
        {restaurants.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-lg">No restaurants available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {restaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}