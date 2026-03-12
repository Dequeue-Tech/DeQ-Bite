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
  const selectedRestaurantSlug = apiClient.getSelectedRestaurantSlug();
  const homeHref = selectedRestaurantSlug ? `/${selectedRestaurantSlug}` : '/';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'menu' | 'users' | 'orders' | 'payments'>('dashboard');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurantUsers, setRestaurantUsers] = useState<RestaurantUserEntry[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cashOrders, setCashOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmingCashOrderId, setConfirmingCashOrderId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [updatingPaymentOrderId, setUpdatingPaymentOrderId] = useState<string | null>(null);
  const [orderStatusDraft, setOrderStatusDraft] = useState<Record<string, Order['status']>>({});
  const [paymentStatusDraft, setPaymentStatusDraft] = useState<Record<string, Order['paymentStatus']>>({});
  const [paymentAmountDraft, setPaymentAmountDraft] = useState<Record<string, string>>({});
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<'OWNER' | 'ADMIN' | 'STAFF'>('STAFF');
  const [paymentPolicy, setPaymentPolicy] = useState<{ paymentCollectionTiming: 'BEFORE_MEAL' | 'AFTER_MEAL'; cashPaymentEnabled: boolean } | null>(null);
  const [menuForm, setMenuForm] = useState<MenuForm>({ name: '', description: '', priceInr: '', categoryId: '' });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');

  const hasAdminAccess = user?.restaurantRole === 'OWNER' || user?.restaurantRole === 'ADMIN';

  useEffect(() => {
    getProfile();
  }, [getProfile]);

  useEffect(() => {
    if (typeof user?.restaurantRole === 'undefined') return;
    if (!hasAdminAccess) {
      router.push(homeHref);
      return;
    }
    loadData();
  }, [user?.restaurantRole, hasAdminAccess, router, homeHref]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
    } else {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!hasAdminAccess || typeof window === 'undefined') return;
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    let source: EventSource | null = null;
    try {
      source = new EventSource(apiClient.getEventStreamUrl(token));
    } catch {
      source = null;
    }

    if (!source) return;

    const onOrderUpdated = () => {
      loadData();
    };

    source.addEventListener('order.created', onOrderUpdated);
    source.addEventListener('order.updated', onOrderUpdated);

    source.onerror = () => {
      // Browser will retry automatically; no-op
    };

    return () => {
      source?.close();
    };
  }, [hasAdminAccess]);

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
      setOrders(orders.data || []);
      setCashOrders((orders.data || []).filter((o) => o.paymentProvider === 'CASH' && o.paymentStatus !== 'COMPLETED' && o.status !== 'CANCELLED'));
      setPaymentPolicy(policy || null);

      if (typeof window !== 'undefined') {
        const nextOrders = orders.data || [];
        const snapshotRaw = localStorage.getItem('admin_order_snapshot');
        const isInitialSnapshot = !snapshotRaw;
        const snapshot: Record<string, { status: string; paymentStatus: string }> = snapshotRaw ? JSON.parse(snapshotRaw) : {};
        const newMessages: string[] = [];

        nextOrders.forEach((order) => {
          const prev = snapshot[order.id];
          if (!prev && !isInitialSnapshot) {
            newMessages.push(`New order #${order.id.slice(0, 8).toUpperCase()} awaiting confirmation`);
          }
          if (prev && prev.status !== order.status) {
            newMessages.push(`Order #${order.id.slice(0, 8).toUpperCase()} moved to ${order.status}`);
          }
          if (prev && prev.paymentStatus !== order.paymentStatus) {
            newMessages.push(`Payment for order #${order.id.slice(0, 8).toUpperCase()} is ${order.paymentStatus}`);
          }
        });

        if (newMessages.length) {
          newMessages.slice(0, 3).forEach((msg) => toast(msg));
          if ('Notification' in window && Notification.permission === 'granted') {
            newMessages.slice(0, 3).forEach((msg) => {
              try {
                new Notification('Admin Order Update', { body: msg });
              } catch {
                // ignore notification errors
              }
            });
          }
        }

        const nextSnapshot: Record<string, { status: string; paymentStatus: string }> = {};
        nextOrders.forEach((order) => {
          nextSnapshot[order.id] = { status: order.status, paymentStatus: order.paymentStatus };
        });
        localStorage.setItem('admin_order_snapshot', JSON.stringify(nextSnapshot));
      }

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
  const pendingOrders = useMemo(() => orders.filter((order) => order.status === 'PENDING'), [orders]);
  const activeOrders = useMemo(() => orders.filter((order) => !['COMPLETED', 'CANCELLED'].includes(order.status)), [orders]);

  const ordersByStatus = useMemo(() => {
    return orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<Order['status'], number>);
  }, [orders]);

  const completedOrders = useMemo(() => orders.filter((order) => order.paymentStatus === 'COMPLETED'), [orders]);
  const totalRevenuePaise = useMemo(() => completedOrders.reduce((sum, order) => sum + order.totalPaise, 0), [completedOrders]);
  const avgOrderValuePaise = useMemo(() => (completedOrders.length ? Math.round(totalRevenuePaise / completedOrders.length) : 0), [completedOrders.length, totalRevenuePaise]);

  const salesByDay = useMemo(() => {
    const days: Array<{ label: string; value: number }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const label = date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      const total = completedOrders
        .filter((order) => {
          const created = new Date(order.createdAt);
          return created.toDateString() === date.toDateString();
        })
        .reduce((sum, order) => sum + order.totalPaise, 0);
      days.push({ label, value: total });
    }
    return days;
  }, [completedOrders]);

  const topDishes = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    completedOrders.forEach((order) => {
      order.items.forEach((item) => {
        const key = item.menuItem?.id || item.menuItemId;
        const entry = map.get(key) || { name: item.menuItem?.name || 'Item', qty: 0, revenue: 0 };
        entry.qty += item.quantity;
        entry.revenue += item.pricePaise * item.quantity;
        map.set(key, entry);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [completedOrders]);

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      setUpdatingOrderId(orderId);
      const response = await apiClient.updateOrderStatus(orderId, status);
      if (!response.success) {
        throw new Error(response.error || 'Failed to update order status');
      }
      toast.success(`Order updated to ${status}`);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const updatePaymentStatus = async (orderId: string) => {
    const status = paymentStatusDraft[orderId];
    if (!status) {
      toast.error('Select a payment status');
      return;
    }
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      toast.error('Order not found');
      return;
    }

    const amountRaw = (paymentAmountDraft[orderId] || '').trim();
    let amountPaise: number | undefined;
    if (amountRaw) {
      const amountInr = Number(amountRaw);
      if (!Number.isFinite(amountInr) || amountInr <= 0) {
        toast.error('Enter a valid paid amount in INR');
        return;
      }
      amountPaise = Math.round(amountInr * 100);
    }

    try {
      setUpdatingPaymentOrderId(orderId);
      if (status === 'PARTIALLY_PAID') {
        if (typeof amountPaise !== 'number') {
          toast.error('Paid amount is required for PARTIALLY_PAID');
          return;
        }
        if (amountPaise >= order.totalPaise) {
          toast.error('Paid amount must be less than the order total');
          return;
        }
      }

      await apiClient.updatePaymentStatus({
        orderId,
        paymentStatus: status,
        ...(status === 'PARTIALLY_PAID' ? { paidAmountPaise: amountPaise } : {}),
      });
      toast.success('Payment status updated');
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update payment status');
    } finally {
      setUpdatingPaymentOrderId(null);
    }
  };

  const salesMax = useMemo(() => Math.max(1, ...salesByDay.map((d) => d.value)), [salesByDay]);
  const statusMax = useMemo(() => Math.max(1, ...Object.values(ordersByStatus)), [ordersByStatus]);

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Browser notifications are not supported');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      toast.success('Admin notifications enabled');
    } else if (permission === 'denied') {
      toast.error('Notifications blocked. Enable them in browser settings.');
    }
  };

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
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Restaurant Admin</h1>
            </div>
            {notificationPermission === 'default' && (
              <button
                onClick={requestNotificationPermission}
                className="text-xs sm:text-sm text-orange-600 hover:text-orange-700"
              >
                Enable Admin Alerts
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">Manage menu, users, and payments.</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
          <button onClick={() => setActiveTab('dashboard')} className={`px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base ${activeTab === 'dashboard' ? 'bg-orange-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>Dashboard</button>
          <button onClick={() => setActiveTab('orders')} className={`px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base ${activeTab === 'orders' ? 'bg-orange-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>Orders</button>
          <button onClick={() => setActiveTab('menu')} className={`px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base ${activeTab === 'menu' ? 'bg-orange-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>Menu</button>
          <button onClick={() => setActiveTab('users')} className={`px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base ${activeTab === 'users' ? 'bg-orange-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>Users</button>
          <button onClick={() => setActiveTab('payments')} className={`px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base ${activeTab === 'payments' ? 'bg-orange-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>Payments</button>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500">Total revenue</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 mt-1">{formatInr(totalRevenuePaise)}</p>
                <p className="text-xs text-gray-500 mt-1">Completed payments</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500">Orders</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 mt-1">{orders.length}</p>
                <p className="text-xs text-gray-500 mt-1">{activeOrders.length} active</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500">Avg order value</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 mt-1">{formatInr(avgOrderValuePaise)}</p>
                <p className="text-xs text-gray-500 mt-1">Paid orders only</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500">Pending confirmations</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 mt-1">{pendingOrders.length}</p>
                <p className="text-xs text-gray-500 mt-1">Requires staff/admin action</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-900 text-sm sm:text-base">Sales (last 7 days)</h2>
                  <span className="text-xs text-gray-500">₹ in paid orders</span>
                </div>
                <div className="grid grid-cols-7 gap-2 items-end h-32 sm:h-40">
                  {salesByDay.map((day) => (
                    <div key={day.label} className="flex flex-col items-center justify-end h-full">
                      <div
                        className="w-full rounded-md bg-orange-500/80"
                        style={{ height: `${Math.max(8, Math.round((day.value / salesMax) * 100))}%` }}
                      />
                      <span className="text-[10px] sm:text-xs text-gray-500 mt-1">{day.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
                <h2 className="font-semibold text-gray-900 text-sm sm:text-base mb-3">Orders by status</h2>
                <div className="space-y-2">
                  {(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'] as Order['status'][]).map((status) => (
                    <div key={status} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-20">{status}</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-orange-500"
                          style={{ width: `${Math.max(6, Math.round(((ordersByStatus[status] || 0) / statusMax) * 100))}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-6 text-right">{ordersByStatus[status] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
                <h2 className="font-semibold text-gray-900 text-sm sm:text-base mb-3">Top dishes (by revenue)</h2>
                {topDishes.length === 0 ? (
                  <p className="text-xs sm:text-sm text-gray-500">No completed orders yet.</p>
                ) : (
                  <div className="space-y-2">
                    {topDishes.map((dish, idx) => (
                      <div key={`${dish.name}-${idx}`} className="flex items-center justify-between text-xs sm:text-sm">
                        <div className="min-w-0">
                          <p className="text-gray-900 font-medium truncate">{dish.name}</p>
                          <p className="text-gray-500">{dish.qty} sold</p>
                        </div>
                        <span className="text-gray-900 font-semibold">{formatInr(dish.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
                <h2 className="font-semibold text-gray-900 text-sm sm:text-base mb-3">Pending confirmations</h2>
                {pendingOrders.length === 0 ? (
                  <p className="text-xs sm:text-sm text-gray-500">No orders waiting for confirmation.</p>
                ) : (
                  <div className="space-y-2">
                    {pendingOrders.slice(0, 5).map((order) => (
                      <div key={order.id} className="border border-gray-200 rounded-lg p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">#{order.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-xs text-gray-600 truncate">{order.user?.name || 'Customer'} | {formatInr(order.totalPaise)}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateOrderStatus(order.id, 'CONFIRMED')}
                            disabled={updatingOrderId === order.id}
                            className="text-xs px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => updateOrderStatus(order.id, 'CANCELLED')}
                            disabled={updatingOrderId === order.id}
                            className="text-xs px-3 py-1.5 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
              <h2 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Orders needing action</h2>
              {pendingOrders.length === 0 ? (
                <p className="text-xs sm:text-sm text-gray-500">No pending orders right now.</p>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {pendingOrders.map((order) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm sm:text-base">#{order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-gray-600 truncate">{order.user?.name || 'Customer'} | {formatInr(order.totalPaise)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateOrderStatus(order.id, 'CONFIRMED')} disabled={updatingOrderId === order.id} className="text-xs px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60">Confirm</button>
                        <button onClick={() => updateOrderStatus(order.id, 'CANCELLED')} disabled={updatingOrderId === order.id} className="text-xs px-3 py-1.5 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-60">Cancel</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
              <h2 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">All restaurant orders</h2>
              <div className="space-y-2 sm:space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm sm:text-base">#{order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-gray-600 truncate">{order.user?.name || 'Customer'} | {formatInr(order.totalPaise)} | {order.status}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <select
                          value={orderStatusDraft[order.id] || order.status}
                          onChange={(e) => setOrderStatusDraft((prev) => ({ ...prev, [order.id]: e.target.value as Order['status'] }))}
                          className="border border-gray-300 rounded px-2 py-1"
                        >
                          {(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'] as Order['status'][]).map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => updateOrderStatus(order.id, orderStatusDraft[order.id] || order.status)}
                          disabled={updatingOrderId === order.id}
                          className="px-2.5 py-1 rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60"
                        >
                          {updatingOrderId === order.id ? 'Updating...' : 'Update Status'}
                        </button>
                        <button
                          onClick={() => updateOrderStatus(order.id, 'CANCELLED')}
                          disabled={updatingOrderId === order.id}
                          className="px-2.5 py-1 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs sm:text-sm text-gray-600">
                      <div>Payment: <span className="font-medium text-gray-800">{order.paymentStatus}</span></div>
                      <div>Paid: {formatInr(order.paidAmountPaise || 0)}</div>
                      <div>Due: {formatInr(order.dueAmountPaise || 0)}</div>
                      <div>Provider: {order.paymentProvider || 'NA'}</div>
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                      <select
                        value={paymentStatusDraft[order.id] || order.paymentStatus}
                        onChange={(e) => setPaymentStatusDraft((prev) => ({ ...prev, [order.id]: e.target.value as Order['paymentStatus'] }))}
                        className="border border-gray-300 rounded px-2 py-1 text-xs sm:text-sm"
                      >
                        {(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_PAID'] as Order['paymentStatus'][]).map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <input
                        value={paymentAmountDraft[order.id] || ''}
                        onChange={(e) => setPaymentAmountDraft((prev) => ({ ...prev, [order.id]: e.target.value }))}
                        placeholder="Paid amount (INR)"
                        className="border border-gray-300 rounded px-2 py-1 text-xs sm:text-sm w-40"
                      />
                      <button
                        onClick={() => updatePaymentStatus(order.id)}
                        disabled={updatingPaymentOrderId === order.id}
                        className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 text-xs sm:text-sm"
                      >
                        {updatingPaymentOrderId === order.id ? 'Updating...' : 'Update Payment'}
                      </button>
                      <span className="text-xs text-gray-500">Use paid amount for PARTIALLY_PAID only.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
              <h2 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Add Dish</h2>
              <div className="space-y-2 sm:space-y-3">
                <input placeholder="Dish name" value={menuForm.name} onChange={(e) => setMenuForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <textarea placeholder="Description" rows={3} value={menuForm.description} onChange={(e) => setMenuForm((prev) => ({ ...prev, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Price (INR)" value={menuForm.priceInr} onChange={(e) => setMenuForm((prev) => ({ ...prev, priceInr: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <select value={menuForm.categoryId} onChange={(e) => setMenuForm((prev) => ({ ...prev, categoryId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {categories.map((category) => (<option key={category.id} value={category.id}>{category.name}</option>))}
                </select>
                <button onClick={createMenuItem} disabled={saving} className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:opacity-60 inline-flex items-center justify-center text-sm">
                  <Plus className="h-4 w-4 mr-1" />{saving ? 'Saving...' : 'Add Dish'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
              <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-sm sm:text-base">All Dishes ({menuItems.length})</h2>
                <span className="text-xs sm:text-sm text-gray-600">{availableCount} available</span>
              </div>
              <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 max-h-[400px] sm:max-h-[580px] overflow-auto">
                {menuItems.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">{item.name}</p>
                      <p className="text-xs text-gray-600">{item.category?.name} - {formatInr(item.pricePaise)}</p>
                      <span className={`inline-block text-xs mt-1 px-2 py-1 rounded ${item.available ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>{item.available ? 'Available' : 'Unavailable'}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleAvailability(item)} className="text-xs px-2.5 sm:px-3 py-1.5 sm:py-2 rounded border border-gray-300 hover:bg-gray-100 whitespace-nowrap">{item.available ? 'Mark Unavail.' : 'Mark Avail.'}</button>
                      <button onClick={() => removeDish(item)} className="text-xs px-2.5 sm:px-3 py-1.5 sm:py-2 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 inline-flex items-center whitespace-nowrap"><Trash2 className="h-3.5 w-3.5 mr-1" />Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
            <h2 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Restaurant Users (Admin/Staff)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
              <input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="Existing user email" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <select value={userRole} onChange={(e) => setUserRole(e.target.value as 'OWNER' | 'ADMIN' | 'STAFF')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="STAFF">Staff</option><option value="ADMIN">Admin</option><option value="OWNER">Owner</option>
              </select>
              <button onClick={addRestaurantUser} className="bg-orange-600 text-white rounded-lg px-3 sm:px-4 py-2 hover:bg-orange-700 text-sm">Add / Update User</button>
            </div>

            <div className="space-y-2">
              {restaurantUsers.map((entry) => (
                <div key={entry.membershipId} className="border border-gray-200 rounded-lg p-2.5 sm:p-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1 mr-2"><p className="font-medium text-gray-900 text-sm sm:text-base truncate">{entry.user.name}</p><p className="text-xs text-gray-600 truncate">{entry.user.email}</p></div>
                  <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 whitespace-nowrap">{entry.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
              <h2 className="font-semibold text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Payment Policy</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">When to collect payment</label>
                  <select
                    value={paymentPolicy?.paymentCollectionTiming || 'AFTER_MEAL'}
                    onChange={(e) => setPaymentPolicy((prev) => ({
                      paymentCollectionTiming: e.target.value as 'BEFORE_MEAL' | 'AFTER_MEAL',
                      cashPaymentEnabled: prev?.cashPaymentEnabled ?? true,
                    }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="BEFORE_MEAL">Before Meal (Compulsory)</option>
                    <option value="AFTER_MEAL">After Meal (Pay at End)</option>
                  </select>
                </div>
                <div className="flex items-center pt-0 sm:pt-6">
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
                  <label htmlFor="cashEnabled" className="text-xs sm:text-sm text-gray-700">Allow cash payments</label>
                </div>
              </div>
              <button onClick={savePaymentPolicy} className="mt-3 sm:mt-4 bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-orange-700 text-sm">Save Policy</button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
              <h2 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Cash Payments Pending Confirmation</h2>
              {cashOrders.length === 0 ? (
                <p className="text-xs sm:text-sm text-gray-600">No pending cash payments.</p>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {cashOrders.map((order) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm sm:text-base">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-gray-600 truncate">{order.user?.name || 'Customer'} | {formatInr(order.totalPaise)} | {order.status}</p>
                      </div>
                      <button
                        onClick={() => confirmCashPayment(order.id)}
                        disabled={confirmingCashOrderId === order.id}
                        className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60 inline-flex items-center justify-center text-xs sm:text-sm whitespace-nowrap"
                      >
                        <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                        {confirmingCashOrderId === order.id ? 'Confirming...' : 'Confirm'}
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
