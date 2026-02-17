'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { formatInr } from '@/lib/currency';
import toast from 'react-hot-toast';

export default function RestaurantLandingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<any>(null);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const details = await apiClient.getRestaurantPublicDetails(id);
        setRestaurant(details);
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load restaurant');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [id]);

  const selectAndOpen = () => {
    if (!restaurant?.subdomain) return;
    apiClient.setSelectedRestaurantSubdomain(restaurant.subdomain);
    toast.success(`${restaurant.name} selected`);
    router.push('/menu');
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-8">Loading restaurant...</div>;
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p className="text-gray-700">Restaurant not found.</p>
        <Link href="/" className="text-orange-600">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{restaurant.name}</h1>
          <p className="text-gray-600 mt-2">{restaurant.address || 'Address not provided'}</p>
          <p className="text-sm text-gray-500 mt-1">
            Payment: {restaurant.paymentCollectionTiming === 'BEFORE_MEAL' ? 'Payment required before meal' : 'Pay at end of meal'}
            {restaurant.cashPaymentEnabled ? ' | Cash accepted' : ' | Cash not accepted'}
          </p>

          <div className="mt-4 flex gap-3">
            <button
              onClick={selectAndOpen}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
            >
              Select & Open Menu
            </button>
            <Link href="/" className="border border-gray-300 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50">
              Back
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Categories</h2>
            <div className="flex flex-wrap gap-2">
              {(restaurant.categories || []).map((cat: any) => (
                <span key={cat.id} className="text-sm bg-orange-100 text-orange-700 px-2 py-1 rounded">{cat.name}</span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Popular Dishes</h2>
            <div className="space-y-2">
              {(restaurant.menuItems || []).slice(0, 6).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between border border-gray-100 rounded p-2">
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.category?.name}</p>
                  </div>
                  <span className="font-semibold text-orange-700">{formatInr(item.pricePaise)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
