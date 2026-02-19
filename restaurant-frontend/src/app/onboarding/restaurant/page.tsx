'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Mail, MapPin, Phone } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';

export default function RestaurantOnboardingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      toast.error('Please sign in first');
      router.push('/auth/signin');
      return;
    }

    try {
      setLoading(true);
      const restaurant = await apiClient.createRestaurant(form);
      apiClient.setSelectedRestaurantSubdomain(restaurant.subdomain);
      toast.success('Restaurant onboarded successfully');
      router.push('/admin');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to onboard restaurant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-10">
      <div className="max-w-2xl mx-auto px-3 sm:px-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Onboard New Restaurant</h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Create a restaurant tenant and set yourself as owner.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Restaurant Name</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  required
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 sm:py-2.5 text-sm"
                  placeholder="Spice Garden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 sm:py-2.5 text-sm"
                    placeholder="owner@restaurant.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    value={form.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 sm:py-2.5 text-sm"
                    placeholder="+1 555 123 4567"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <textarea
                  rows={3}
                  value={form.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 sm:py-2.5 text-sm"
                  placeholder="Street, City, State"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 text-white py-2.5 sm:py-3 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-60 text-sm sm:text-base"
            >
              {loading ? 'Creating...' : 'Create Restaurant'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
