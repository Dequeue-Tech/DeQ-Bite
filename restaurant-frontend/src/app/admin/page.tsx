'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, Category, MenuItem, Order, RestaurantUserEntry } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';
import { ChefHat, Plus, Trash2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatInr } from '@/lib/currency';

type MenuForm = {
  name: string;
  description: string;
  priceInr: string;
  categoryId: string;
};

export default function AdminPage() {
  const router = useRouter();
  const { user, getProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'menu' | 'users' | 'payments'>('menu');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurantUsers, setRestaurantUsers] = useState<RestaurantUserEntry[]>([]);
  const [cashOrders, setCashOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmingCashOrderId, setConfirmingCashOrderId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<'OWNER' | 'ADMIN' | 'STAFF'>('STAFF');
  const [paymentPolicy, setPaymentPolicy] = useState<{ paymentCollectionTiming: 'BEFORE_MEAL' | 'AFTER_MEAL'; cashPaymentEnabled: boolean } | null>(null);
  const [menuForm, setMenuForm] = useState<MenuForm>({ name: '', description: '', priceInr: '', categoryId: '' });

  const hasAdminAccess = user?.restaurantRole === 'OWNER' || user?.restaurantRole === 'ADMIN';

  useEffect(() => {
    getProfile();
  }, [getProfile]);

  useEffect(() => {
    if (typeof user?.restaurantRole === 'undefined') return;
    if (!hasAdminAccess) {
      router.push('/');
      return;
    }
    loadData();
  }, [user?.restaurantRole, hasAdminAccess, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [menuRes, categoriesRes, users, orders, policy] = await Promise.all([
        apiClient.getAdminMenuItems(),
        apiClient.getCategories(),
        apiClient.getRestaurantUsers(),
        apiClient.getRestaurantOrders(),
        apiClient.getRestaurantPaymentPolicy(),
      ]);

      setMenuItems(menuRes.data || []);
      setCategories(categoriesRes.data || []);
      setRestaurantUsers(users);
      setCashOrders((orders.data || []).filter((o) => o.paymentProvider === 'CASH' && o.paymentStatus !== 'COMPLETED' && o.status !== 'CANCELLED'));
      setPaymentPolicy(policy || null);

      if (!menuForm.categoryId && (categoriesRes.data || [])[0]) {
        setMenuForm((prev) => ({ ...prev, categoryId: (categoriesRes.data || [])[0].id }));
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const availableCount = useMemo(() => menuItems.filter((item) => item.available).length, [menuItems]);

  const createMenuItem = async () => {
    if (!menuForm.name || !menuForm.priceInr || !menuForm.categoryId) {
      toast.error('Name, price, and category are required');
      return;
    }

    const priceInr = Number(menuForm.priceInr);
    if (!Number.isFinite(priceInr) || priceInr <= 0) {
      toast.error('Price must be a valid positive number');
      return;
    }

    try {
      setSaving(true);
      const response = await apiClient.createMenuItem({
        name: menuForm.name,
        description: menuForm.description || undefined,
        pricePaise: Math.round(priceInr * 100),
        categoryId: menuForm.categoryId,
      });
      if (response.success) {
        toast.success('Dish added to menu');
        setMenuForm((prev) => ({ ...prev, name: '', description: '', priceInr: '' }));
        await loadData();
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create menu item');
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      await apiClient.updateMenuAvailability(item.id, !item.available);
      toast.success(`Dish marked as ${!item.available ? 'available' : 'unavailable'}`);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update availability');
    }
  };

  const removeDish = async (item: MenuItem) => {
    try {
      await apiClient.deleteMenuItem(item.id);
      toast.success(`${item.name} removed`);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove dish');
    }
  };

  const addRestaurantUser = async () => {
    if (!userEmail) {
      toast.error('Enter a user email');
      return;
    }

    try {
      await apiClient.addRestaurantUser({ email: userEmail, role: userRole });
      toast.success('Restaurant user updated');
      setUserEmail('');
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add restaurant user');
    }
  };

  const savePaymentPolicy = async () => {
    if (!paymentPolicy) return;
    try {
      await apiClient.updateRestaurantPaymentPolicy(paymentPolicy);
      toast.success('Payment policy updated');
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save payment policy');
    }
  };

  const confirmCashPayment = async (orderId: string) => {
    try {
      setConfirmingCashOrderId(orderId);
      await apiClient.confirmCashPayment(orderId);
      toast.success('Cash payment confirmed');
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to confirm cash payment');
    } finally {
      setConfirmingCashOrderId(null);
    }
  };

  if (typeof user?.restaurantRole === 'undefined' || loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-600">Loading admin workspace...</p></div>;
  }

  if (!hasAdminAccess) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-orange-600" />
            <h1 className="text-2xl font-bold text-gray-900">Restaurant Admin</h1>
          </div>
          <p className="text-sm text-gray-600 mt-1">Manage menu, users, and payments.</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('menu')} className={`px-4 py-2 rounded-lg ${activeTab === 'menu' ? 'bg-orange-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>Menu</button>
          <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-lg ${activeTab === 'users' ? 'bg-orange-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>Users</button>
          <button onClick={() => setActiveTab('payments')} className={`px-4 py-2 rounded-lg ${activeTab === 'payments' ? 'bg-orange-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>Payments</button>
        </div>

        {activeTab === 'menu' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Add Dish</h2>
              <div className="space-y-3">
                <input placeholder="Dish name" value={menuForm.name} onChange={(e) => setMenuForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                <textarea placeholder="Description" rows={3} value={menuForm.description} onChange={(e) => setMenuForm((prev) => ({ ...prev, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                <input placeholder="Price (INR)" value={menuForm.priceInr} onChange={(e) => setMenuForm((prev) => ({ ...prev, priceInr: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                <select value={menuForm.categoryId} onChange={(e) => setMenuForm((prev) => ({ ...prev, categoryId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  {categories.map((category) => (<option key={category.id} value={category.id}>{category.name}</option>))}
                </select>
                <button onClick={createMenuItem} disabled={saving} className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:opacity-60 inline-flex items-center justify-center">
                  <Plus className="h-4 w-4 mr-1" />{saving ? 'Saving...' : 'Add Dish'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">All Dishes ({menuItems.length})</h2>
                <span className="text-sm text-gray-600">{availableCount} currently available</span>
              </div>
              <div className="p-4 space-y-3 max-h-[580px] overflow-auto">
                {menuItems.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.category?.name} - {formatInr(item.pricePaise)}</p>
                      <span className={`inline-block text-xs mt-1 px-2 py-1 rounded ${item.available ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>{item.available ? 'Available' : 'Unavailable'}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleAvailability(item)} className="text-xs px-3 py-2 rounded border border-gray-300 hover:bg-gray-100">{item.available ? 'Mark Unavailable' : 'Mark Available'}</button>
                      <button onClick={() => removeDish(item)} className="text-xs px-3 py-2 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 inline-flex items-center"><Trash2 className="h-3.5 w-3.5 mr-1" />Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-4">Restaurant Users (Admin/Staff)</h2>
            <div className="grid md:grid-cols-3 gap-3 mb-4">
              <input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="Existing user email" className="border border-gray-300 rounded-lg px-3 py-2" />
              <select value={userRole} onChange={(e) => setUserRole(e.target.value as 'OWNER' | 'ADMIN' | 'STAFF')} className="border border-gray-300 rounded-lg px-3 py-2">
                <option value="STAFF">Staff</option><option value="ADMIN">Admin</option><option value="OWNER">Owner</option>
              </select>
              <button onClick={addRestaurantUser} className="bg-orange-600 text-white rounded-lg px-4 py-2 hover:bg-orange-700">Add / Update User</button>
            </div>

            <div className="space-y-2">
              {restaurantUsers.map((entry) => (
                <div key={entry.membershipId} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                  <div><p className="font-medium text-gray-900">{entry.user.name}</p><p className="text-sm text-gray-600">{entry.user.email}</p></div>
                  <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700">{entry.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Payment Policy</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">When to collect payment</label>
                  <select
                    value={paymentPolicy?.paymentCollectionTiming || 'AFTER_MEAL'}
                    onChange={(e) => setPaymentPolicy((prev) => ({
                      paymentCollectionTiming: e.target.value as 'BEFORE_MEAL' | 'AFTER_MEAL',
                      cashPaymentEnabled: prev?.cashPaymentEnabled ?? true,
                    }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="BEFORE_MEAL">Before Meal (Compulsory)</option>
                    <option value="AFTER_MEAL">After Meal (Pay at End)</option>
                  </select>
                </div>
                <div className="flex items-center pt-6">
                  <input
                    id="cashEnabled"
                    type="checkbox"
                    checked={paymentPolicy?.cashPaymentEnabled ?? true}
                    onChange={(e) => setPaymentPolicy((prev) => ({
                      paymentCollectionTiming: prev?.paymentCollectionTiming || 'AFTER_MEAL',
                      cashPaymentEnabled: e.target.checked,
                    }))}
                    className="mr-2"
                  />
                  <label htmlFor="cashEnabled" className="text-sm text-gray-700">Allow cash payments</label>
                </div>
              </div>
              <button onClick={savePaymentPolicy} className="mt-4 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700">Save Policy</button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Cash Payments Pending Confirmation</h2>
              {cashOrders.length === 0 ? (
                <p className="text-sm text-gray-600">No pending cash payments.</p>
              ) : (
                <div className="space-y-3">
                  {cashOrders.map((order) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-sm text-gray-600">{order.user?.name || 'Customer'} | {formatInr(order.totalPaise)} | {order.status}</p>
                      </div>
                      <button
                        onClick={() => confirmCashPayment(order.id)}
                        disabled={confirmingCashOrderId === order.id}
                        className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60 inline-flex items-center"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {confirmingCashOrderId === order.id ? 'Confirming...' : 'Confirm Payment'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
