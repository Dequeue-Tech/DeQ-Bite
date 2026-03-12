'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

// Exporting the type so your page.tsx can use it too
export type RestaurantListItem = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  logoUrl: string | null;
};

export default function SearchableRestaurantList({ 
  initialRestaurants 
}: { 
  initialRestaurants: RestaurantListItem[] 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  // Filter by name or address
  const filteredRestaurants = initialRestaurants.filter((restaurant) => {
    const query = searchQuery.toLowerCase();
    const matchesName = restaurant.name.toLowerCase().includes(query);
    const matchesAddress = restaurant.address?.toLowerCase().includes(query);
    return matchesName || matchesAddress;
  });

  const selectAndOpen = (restaurant: RestaurantListItem) => {
    const slug = restaurant?.slug;
    if (!slug) return;
    try {
      localStorage.setItem('selectedRestaurantSlug', slug);
    } catch {}
    toast.success(`${restaurant.name} selected`);
    router.push(`/${slug}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        
        {/* Header Section */}
        <div className="mb-6 sm:mb-8 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
            Choose Your Restaurant
          </h1>
          <p className="text-base sm:text-lg text-gray-600 mt-2">
            Each restaurant has its own menu and ordering flow.
          </p>
        </div>

        {/* Responsive Search Bar */}
        <div className="relative mb-8 sm:mb-10">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by name or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-11 pr-4 py-3.5 sm:py-4 border border-gray-200 rounded-2xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base shadow-sm transition-all"
          />
        </div>

        {/* Results Section */}
        {filteredRestaurants.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500">
            {initialRestaurants.length === 0 
              ? "No restaurants available yet." 
              : "No restaurants match your search."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredRestaurants.map((restaurant) => (
              <button
                key={restaurant.id}
                onClick={() => selectAndOpen(restaurant)}
                className="inline-flex items-center justify-center bg-orange-600 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl hover:bg-orange-700 font-medium text-sm sm:text-base shadow-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-orange-50 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                    {restaurant.logoUrl ? (
                      <img
                        src={restaurant.logoUrl}
                        alt={restaurant.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-orange-600 font-bold text-xl sm:text-2xl">
                        {restaurant.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                      {restaurant.name}
                    </h2>
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      {restaurant.address || 'Address not provided'}
                    </p>
                    <div className="flex items-center mt-2.5">
                      <span className="text-sm font-medium text-orange-600 group-hover:text-orange-700 transition-colors">
                        View menu
                      </span>
                      <svg className="h-4 w-4 ml-1 text-orange-600 group-hover:text-orange-700 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
