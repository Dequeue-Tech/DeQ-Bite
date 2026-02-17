'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, CircleDollarSign, HandCoins, Percent, Utensils } from 'lucide-react';
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
        const details = await apiClient.getRestaurantPublicDetails(id.toLowerCase());
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

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word: string) => word[0]?.toUpperCase() || '')
      .join('');

  const buildDeals = () => {
    if (!restaurant) return [];

    const topPrice = Math.max(...(restaurant.menuItems || []).map((item: any) => item.pricePaise), 0);
    return [
      {
        title: 'Welcome Deal',
        detail: 'Get 15% OFF on your first order above ' + formatInr(39900),
        icon: Percent,
      },
      {
        title: 'Chef Special Combo',
        detail:
          topPrice > 0
            ? `Trending combo starts from ${formatInr(Math.max(topPrice - 10000, 12900))}`
            : 'Ask for today’s chef special combo at the counter.',
        icon: Utensils,
      },
      {
        title: 'Flexible Payment',
        detail:
          restaurant.paymentCollectionTiming === 'BEFORE_MEAL'
            ? `Payment before meal${restaurant.cashPaymentEnabled ? ' with cash option available.' : '.'}`
            : `Pay after meal${restaurant.cashPaymentEnabled ? ' with cash option available.' : '.'}`,
        icon: restaurant.cashPaymentEnabled ? HandCoins : CircleDollarSign,
      },
    ];
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
        <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-2xl bg-orange-600 text-white flex items-center justify-center text-2xl font-bold shadow-sm">
                {getInitials(restaurant.name)}
              </div>
              <div>
                <p className="text-sm font-medium text-orange-700">Restaurant Landing</p>
                <h1 className="text-3xl font-bold text-gray-900">{restaurant.name}</h1>
                <p className="text-gray-600 mt-1">{restaurant.address || 'Address not provided'}</p>
              </div>
            </div>
            <button
              onClick={selectAndOpen}
              className="inline-flex items-center justify-center bg-orange-600 text-white px-5 py-3 rounded-xl hover:bg-orange-700 font-medium"
            >
              View Menu
              <ArrowRight className="h-4 w-4 ml-2" />
            </button>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Offers & Deals</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {buildDeals().map((deal: any) => (
              <div key={deal.title} className="rounded-lg border border-orange-100 bg-orange-50/60 p-4">
                <deal.icon className="h-5 w-5 text-orange-600 mb-2" />
                <p className="font-semibold text-gray-900">{deal.title}</p>
                <p className="text-sm text-gray-700 mt-1">{deal.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-2">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={selectAndOpen}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
            >
              Open Menu
            </button>
            <Link href="/" className="border border-gray-300 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50">
              Back
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 pb-6">
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
