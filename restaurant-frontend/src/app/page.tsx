'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChefHat, Search, Store, Utensils, PlusSquare } from 'lucide-react';
import { apiClient, MenuItem, RestaurantSummary } from '@/lib/api-client';
import { formatInr } from '@/lib/currency';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const [query, setQuery] = useState('');
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantSummary | null>(null);
  const [previewMenu, setPreviewMenu] = useState<MenuItem[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);

  const searchRestaurants = async () => {
    try {
      setLoadingRestaurants(true);
      const data = await apiClient.searchRestaurants(query);
      setRestaurants(data);
      if (data.length === 0) {
        toast.error('No restaurants found');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to search restaurants');
    } finally {
      setLoadingRestaurants(false);
    }
  };

  const selectRestaurant = (restaurant: RestaurantSummary) => {
    apiClient.setSelectedRestaurantSubdomain(restaurant.subdomain);
    setSelectedRestaurant(restaurant);
    setPreviewMenu([]);
    toast.success(`${restaurant.name} selected`);
  };

  const fetchSelectedMenu = async () => {
    if (!selectedRestaurant) {
      toast.error('Select a restaurant first');
      return;
    }

    try {
      setLoadingMenu(true);
      const response = await apiClient.getMenuItems();
      if (response.success) {
        setPreviewMenu((response.data || []).slice(0, 8));
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to fetch menu');
    } finally {
      setLoadingMenu(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="py-12 bg-gradient-to-br from-orange-50 to-orange-100 border-b border-orange-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Central Restaurant Portal</h1>
              <p className="text-gray-600 mt-2">Search restaurants, open their landing page, and select one for ordering.</p>
            </div>
            {isAuthenticated && (
              <Link
                href="/onboarding/restaurant"
                className="inline-flex items-center bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
              >
                <PlusSquare className="h-4 w-4 mr-2" />
                Onboard Restaurant
              </Link>
            )}
          </div>

          <div className="mt-8 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by restaurant name"
                className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <button
              onClick={searchRestaurants}
              disabled={loadingRestaurants}
              className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-black disabled:opacity-60"
            >
              {loadingRestaurants ? 'Searching...' : 'Search'}
            </button>
          </div>

          {selectedRestaurant && (
            <div className="mt-4 flex flex-wrap items-center gap-3 bg-white rounded-lg border border-gray-200 p-3">
              <span className="text-sm text-gray-500">Selected:</span>
              <span className="font-semibold text-gray-900">{selectedRestaurant.name}</span>
              <button
                onClick={fetchSelectedMenu}
                disabled={loadingMenu}
                className="ml-auto bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-60"
              >
                {loadingMenu ? 'Fetching Menu...' : 'Fetch Selected Menu'}
              </button>
              <Link
                href="/menu"
                className="border border-orange-600 text-orange-700 px-4 py-2 rounded-lg hover:bg-orange-50"
              >
                Open Full Menu
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="py-8">
        <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center">
              <Store className="h-5 w-5 text-orange-600 mr-2" />
              <h2 className="font-semibold text-gray-900">Restaurants</h2>
            </div>
            <div className="p-4 space-y-3 max-h-[420px] overflow-auto">
              {restaurants.length === 0 ? (
                <p className="text-gray-500 text-sm">Use Search to find restaurants.</p>
              ) : (
                restaurants.map((restaurant) => (
                  <div key={restaurant.id} className="border border-gray-200 rounded-lg p-3 flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{restaurant.name}</p>
                      <p className="text-xs text-gray-500">{restaurant.address || 'Address not provided'}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => selectRestaurant(restaurant)}
                        className="text-sm px-3 py-1.5 rounded-md bg-orange-600 text-white hover:bg-orange-700"
                      >
                        Select
                      </button>
                      <Link
                        href={`/restaurants/${restaurant.id}`}
                        className="text-center text-sm px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        View Page
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center">
              <Utensils className="h-5 w-5 text-orange-600 mr-2" />
              <h2 className="font-semibold text-gray-900">Selected Restaurant Menu Preview</h2>
            </div>
            <div className="p-4 space-y-3 max-h-[420px] overflow-auto">
              {previewMenu.length === 0 ? (
                <p className="text-gray-500 text-sm">Select a restaurant, then click "Fetch Selected Menu".</p>
              ) : (
                previewMenu.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.category?.name}</p>
                    </div>
                    <span className="font-semibold text-orange-700">{formatInr(item.pricePaise)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
