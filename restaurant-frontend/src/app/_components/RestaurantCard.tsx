'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Star } from 'lucide-react';

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

export default function RestaurantCard({
  restaurant,
}: {
  restaurant: RestaurantCardProps;
}) {
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
              <p className="text-sm truncate line-clamp-2">
                {restaurant.address}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Price for two</span>
              <span className="text-sm font-semibold text-gray-700">
                ?{(restaurant.priceForTwo || 800) / 100}
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
