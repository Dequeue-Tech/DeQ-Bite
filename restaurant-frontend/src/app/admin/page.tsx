'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, Category, MenuItem, Order, RestaurantUserEntry } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';
import { 
  ChefHat, Plus, Trash2, CheckCircle, TrendingUp, 
  Users, CreditCard, LayoutDashboard, BellRing, 
  Clock, Check, X, Search, Activity, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatInr } from '@/lib/currency';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid 
} from 'recharts';

type MenuForm = {
  name: string;
  description: string;
  priceInr: string;
  categoryId: string;
};

const getStatusColor = (status: Order['status']) => {
  const colors = {
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
    PREPARING: 'bg-purple-100 text-purple-800 border-purple-200',
    READY: 'bg-orange-100 text-orange-800 border-orange-200',
    SERVED: 'bg-teal-100 text-teal-800 border-teal-200',
    COMPLETED: 'bg-green-100 text-green-800 border-green-200',
    CANCELLED: 'bg-red-100 text-red-800 border-red-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
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
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  
  const [confirmingCashOrderId, setConfirmingCashOrderId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [orderStatusDraft, setOrderStatusDraft] = useState<Record<string, Order['status']>>({});
  const [paymentStatusDraft, setPaymentStatusDraft] = useState<Record<string, Order['paymentStatus']>>({});
  const [paymentAmountDraft, setPaymentAmountDraft] = useState<Record<string, string>>({});
  
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<'OWNER' | 'ADMIN' | 'STAFF'>('STAFF');
  const [paymentPolicy, setPaymentPolicy] = useState<{ paymentCollectionTiming: 'BEFORE_MEAL' | 'AFTER_MEAL'; cashPaymentEnabled: boolean } | null>(null);
  const [menuForm, setMenuForm] = useState<MenuForm>({ name: '', description: '', priceInr: '', categoryId: '' });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');

  const hasAdminAccess = user?.restaurantRole === 'OWNER' || user?.restaurantRole === 'ADMIN';

  useEffect(() => { getProfile(); }, [getProfile]);

  useEffect(() => {
    if (typeof user?.restaurantRole === 'undefined') return;
    if (!hasAdminAccess) { router.push(homeHref); return; }
    loadData();
  }, [user?.restaurantRole, hasAdminAccess, router, homeHref]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) { setNotificationPermission('unsupported'); } 
    else { setNotificationPermission(Notification.permission); }
  }, []);

  useEffect(() => {
    if (!hasAdminAccess || typeof window === 'undefined') return;
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    let source: EventSource | null = null;
    try { source = new EventSource(apiClient.getEventStreamUrl(token)); } 
    catch { source = null; }

    if (!source) return;

    const onOrderUpdated = () => loadData();
    source.addEventListener('order.created', onOrderUpdated);
    source.addEventListener('order.updated', onOrderUpdated);
    source.onerror = () => {};

    return () => source?.close();
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
        .filter((order) => new Date(order.createdAt).toDateString() === date.toDateString())
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

  const statusMax = useMemo(() => Math.max(1, ...Object.values(ordersByStatus)), [ordersByStatus]);

  // --- Handlers ---
  
  // Dashboard Quick Action Handler
  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      setUpdatingOrderId(orderId);
      const response = await apiClient.updateOrderStatus(orderId, status);
      if (!response.success) throw new Error(response.error || 'Failed to update order status');
      toast.success(`Order updated to ${status}`);
      await loadData();
    } catch (error: any) { toast.error(error?.message || 'Failed to update order status'); } 
    finally { setUpdatingOrderId(null); }
  };

  // Unified Live Orders Update Handler
  const saveOrderChanges = async (order: Order) => {
    const newOrderStatus = orderStatusDraft[order.id] || order.status;
    const newPaymentStatus = paymentStatusDraft[order.id] || order.paymentStatus;
    
    const promises = [];
    let hasChanges = false;
    
    if (newOrderStatus !== order.status) {
      promises.push(apiClient.updateOrderStatus(order.id, newOrderStatus));
      hasChanges = true;
    }
    
    if (newPaymentStatus !== order.paymentStatus) {
      let amountPaise: number | undefined;
      if (newPaymentStatus === 'PARTIALLY_PAID') {
        const amountRaw = (paymentAmountDraft[order.id] || '').trim();
        if (!amountRaw) return toast.error('Enter a valid paid amount in INR');
        const amountInr = Number(amountRaw);
        if (!Number.isFinite(amountInr) || amountInr <= 0) return toast.error('Enter a valid paid amount in INR');
        amountPaise = Math.round(amountInr * 100);
        if (amountPaise >= order.totalPaise) return toast.error('Paid amount must be less than order total');
      }
      promises.push(apiClient.updatePaymentStatus({
        orderId: order.id, 
        paymentStatus: newPaymentStatus, 
        ...(newPaymentStatus === 'PARTIALLY_PAID' ? { paidAmountPaise: amountPaise } : {})
      }));
      hasChanges = true;
    }

    if (!hasChanges) {
      toast('No changes detected', { icon: 'ℹ️' });
      return;
    }

    try {
      setUpdatingOrderId(order.id);
      await Promise.all(promises);
      toast.success('Order successfully updated');
      await loadData();
    } catch (error: any) { toast.error(error?.message || 'Failed to update order'); } 
    finally { setUpdatingOrderId(null); }
  };

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return toast.error('Browser notifications are not supported');
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') toast.success('Admin notifications enabled');
    else if (permission === 'denied') toast.error('Notifications blocked.');
  };

  const createMenuItem = async () => {
    if (!menuForm.name || !menuForm.priceInr || !menuForm.categoryId) return toast.error('Name, price, and category are required');
    const priceInr = Number(menuForm.priceInr);
    if (!Number.isFinite(priceInr) || priceInr <= 0) return toast.error('Price must be a valid positive number');

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
        setIsMenuModalOpen(false);
        await loadData();
      }
    } catch (error: any) { toast.error(error?.message || 'Failed to create menu item'); } 
    finally { setSaving(false); }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      await apiClient.updateMenuAvailability(item.id, !item.available);
      toast.success(`Dish marked as ${!item.available ? 'available' : 'unavailable'}`);
      await loadData();
    } catch (error: any) { toast.error(error?.message || 'Failed to update availability'); }
  };

  const removeDish = async (item: MenuItem) => {
    try {
      await apiClient.deleteMenuItem(item.id);
      toast.success(`${item.name} removed`);
      await loadData();
    } catch (error: any) { toast.error(error?.message || 'Failed to remove dish'); }
  };

  const addRestaurantUser = async () => {
    if (!userEmail) return toast.error('Enter a user email');
    try {
      await apiClient.addRestaurantUser({ email: userEmail, role: userRole });
      toast.success('Restaurant user updated');
      setUserEmail('');
      await loadData();
    } catch (error: any) { toast.error(error?.message || 'Failed to add restaurant user'); }
  };

  const savePaymentPolicy = async () => {
    if (!paymentPolicy) return;
    try {
      await apiClient.updateRestaurantPaymentPolicy(paymentPolicy);
      toast.success('Payment policy updated');
      await loadData();
    } catch (error: any) { toast.error(error?.message || 'Failed to save payment policy'); }
  };

  const confirmCashPayment = async (orderId: string) => {
    try {
      setConfirmingCashOrderId(orderId);
      await apiClient.confirmCashPayment(orderId);
      toast.success('Cash payment confirmed');
      await loadData();
    } catch (error: any) { toast.error(error?.message || 'Failed to confirm cash payment'); } 
    finally { setConfirmingCashOrderId(null); }
  };

  if (typeof user?.restaurantRole === 'undefined' || loading) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-medium text-sm">Loading Workspace...</p>
        </div>
      </div>
    );
  }

  if (!hasAdminAccess) return null;

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'orders', label: 'Live Orders', icon: Activity },
    { id: 'menu', label: 'Menu', icon: ChefHat },
    { id: 'users', label: 'Team', icon: Users },
    { id: 'payments', label: 'Settings', icon: CreditCard },
  ] as const;

  // Render Form Component used for both Desktop Sidebar and Mobile Modal
  const renderDishForm = () => (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Dish Name</label>
        <input value={menuForm.name} onChange={(e) => setMenuForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500/20" placeholder="e.g. Truffle Fries" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Price (INR)</label>
        <input value={menuForm.priceInr} onChange={(e) => setMenuForm(p => ({ ...p, priceInr: e.target.value }))} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500/20" placeholder="299" type="number" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Category</label>
        <div className="relative">
          <select value={menuForm.categoryId} onChange={(e) => setMenuForm(p => ({ ...p, categoryId: e.target.value }))} className="w-full bg-gray-50 border-none rounded-xl pl-4 pr-10 py-3 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 appearance-none">
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Description</label>
        <textarea value={menuForm.description} onChange={(e) => setMenuForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500/20" placeholder="Short description..." />
      </div>
      <button onClick={createMenuItem} disabled={saving} className="w-full bg-orange-600 text-white py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold hover:bg-orange-700 transition-transform active:scale-95 mt-2 disabled:opacity-50">
        {saving ? 'Saving...' : 'Publish Dish'}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 relative">
      {/* Header Area */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2 sm:p-2.5 rounded-xl text-white shadow-lg shadow-orange-500/20">
                  <ChefHat className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-none">Admin Console</h1>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">@{selectedRestaurantSlug}</p>
                </div>
              </div>
              {/* Mobile Bell Icon */}
              {notificationPermission === 'default' && (
                <button onClick={requestNotificationPermission} className="sm:hidden p-2 text-orange-600 bg-orange-50 rounded-xl">
                  <BellRing className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Desktop Bell Button */}
            {notificationPermission === 'default' && (
              <button
                onClick={requestNotificationPermission}
                className="hidden sm:flex items-center gap-2 text-sm font-bold text-orange-600 bg-orange-50 px-4 py-2.5 rounded-xl hover:bg-orange-100 transition-colors"
              >
                <BellRing className="h-4 w-4" />
                Enable Alerts
              </button>
            )}
          </div>

          {/* Edge-to-Edge Scrollable Pill Navigation on Mobile */}
          <div className="relative mt-5 sm:mt-6">
            <div className="flex overflow-x-auto gap-2 p-1 bg-gray-100/60 rounded-xl sm:rounded-2xl w-full border border-gray-100 -mx-4 px-4 sm:mx-0 sm:px-1 sm:w-max no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg sm:rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab.id 
                      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/50' 
                      : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    {tab.id === 'orders' && pendingOrders.length > 0 && (
                      <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-1">
                        {pendingOrders.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                <p className="text-xs sm:text-sm font-bold text-gray-500 flex items-center gap-1.5"><TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" /> Revenue</p>
                <p className="text-xl sm:text-3xl font-black text-gray-900 mt-1 sm:mt-2 truncate">{formatInr(totalRevenuePaise)}</p>
              </div>

              <div className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                <p className="text-xs sm:text-sm font-bold text-gray-500 flex items-center gap-1.5"><LayoutDashboard className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" /> Orders</p>
                <p className="text-xl sm:text-3xl font-black text-gray-900 mt-1 sm:mt-2">{orders.length}</p>
              </div>

              <div className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                <p className="text-xs sm:text-sm font-bold text-gray-500 flex items-center gap-1.5"><Activity className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" /> Avg Order</p>
                <p className="text-xl sm:text-3xl font-black text-gray-900 mt-1 sm:mt-2 truncate">{formatInr(avgOrderValuePaise)}</p>
              </div>

              <div className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                <p className="text-xs sm:text-sm font-bold text-gray-500 flex items-center gap-1.5"><Clock className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500" /> Action</p>
                <p className="text-xl sm:text-3xl font-black text-gray-900 mt-1 sm:mt-2">{pendingOrders.length}</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100">
                <div className="mb-4">
                  <h2 className="text-lg sm:text-xl font-black text-gray-900">Revenue Flow</h2>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Last 7 days performance</p>
                </div>
                
                <div className="h-48 sm:h-64 mt-4 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesByDay} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} tickFormatter={(value) => `₹${value / 100}`} />
                      <Tooltip cursor={{ fill: '#fff7ed' }} content={({ active, payload }) => active && payload && payload.length ? (<div className="bg-gray-900 text-white text-xs font-bold py-2 px-3 rounded-lg shadow-xl">{formatInr(payload[0].value as number)}</div>) : null} />
                      <Bar dataKey="value" fill="#ea580c" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-5 sm:mb-6">Pipeline</h2>
                <div className="space-y-4">
                  {(['PENDING', 'PREPARING', 'READY', 'COMPLETED'] as Order['status'][]).map((status) => {
                    const count = ordersByStatus[status] || 0;
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-500 w-20">{status}</span>
                        <div className="flex-1 h-2 sm:h-3 rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full rounded-full ${status === 'COMPLETED' ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${Math.max(5, Math.round((count / statusMax) * 100))}%` }} />
                        </div>
                        <span className="text-xs sm:text-sm font-black text-gray-900 w-6 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
                  <ChefHat className="h-5 w-5 text-orange-500" /> Top Dishes
                </h2>
                {topDishes.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Not enough data yet.</p>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {topDishes.map((dish, idx) => (
                      <div key={`${dish.name}-${idx}`} className="flex items-center justify-between p-2 sm:p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 pr-4">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 rounded-full bg-orange-100 text-orange-600 font-black flex items-center justify-center text-xs">#{idx + 1}</div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-xs sm:text-sm truncate">{dish.name}</p>
                            <p className="text-[10px] sm:text-xs font-medium text-gray-500">{dish.qty} servings</p>
                          </div>
                        </div>
                        <span className="font-black text-gray-900 text-xs sm:text-sm shrink-0">{formatInr(dish.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
                  <BellRing className="h-5 w-5 text-orange-500" /> Action Required
                </h2>
                {pendingOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 text-green-400 mx-auto mb-2 sm:mb-3" />
                    <p className="text-xs sm:text-sm font-bold text-gray-500">All caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingOrders.slice(0, 4).map((order) => (
                      <div key={order.id} className="bg-gray-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-gray-100">
                        <div>
                          <p className="font-black text-gray-900 text-sm sm:text-base">#{order.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-[10px] sm:text-xs font-medium text-gray-500 mt-0.5">{order.user?.name || 'Guest'} • {formatInr(order.totalPaise)}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => updateOrderStatus(order.id, 'CONFIRMED')} disabled={updatingOrderId === order.id} className="flex-1 sm:flex-none text-xs font-bold px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-gray-900 text-white hover:bg-black transition-colors disabled:opacity-50">Confirm</button>
                          <button onClick={() => updateOrderStatus(order.id, 'CANCELLED')} disabled={updatingOrderId === order.id} className="flex-1 sm:flex-none text-xs font-bold px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50">Decline</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ORDERS TAB - With Unified Controls */}
        {activeTab === 'orders' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-lg sm:text-xl font-black text-gray-900">Live Orders</h2>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="text" placeholder="Search ID..." className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20" />
                </div>
              </div>
              
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className="bg-white border border-gray-100 rounded-2xl sm:rounded-[24px] p-4 sm:p-5 hover:border-orange-200 transition-colors">
                    <div className="flex flex-col lg:flex-row justify-between gap-5">
                      
                      {/* Order Details */}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                          <span className="font-black text-base sm:text-lg text-gray-900">#{order.id.slice(0, 8).toUpperCase()}</span>
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 sm:px-3 py-1 rounded-md border ${getStatusColor(order.status)}`}>{order.status}</span>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-gray-500">{order.user?.name || 'Walk-in'} • {formatInr(order.totalPaise)}</p>
                        
                        <div className="mt-3 sm:mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100">
                          <div><p className="text-[10px] font-bold text-gray-400 uppercase">Payment</p><p className="text-xs sm:text-sm font-black text-gray-900 mt-0.5 truncate">{order.paymentStatus}</p></div>
                          <div><p className="text-[10px] font-bold text-gray-400 uppercase">Method</p><p className="text-xs sm:text-sm font-black text-gray-900 mt-0.5 truncate">{order.paymentProvider || 'NA'}</p></div>
                          <div><p className="text-[10px] font-bold text-gray-400 uppercase">Paid</p><p className="text-xs sm:text-sm font-black text-green-600 mt-0.5 truncate">{formatInr(order.paidAmountPaise || 0)}</p></div>
                          <div><p className="text-[10px] font-bold text-gray-400 uppercase">Due</p><p className="text-xs sm:text-sm font-black text-orange-600 mt-0.5 truncate">{formatInr(order.dueAmountPaise || 0)}</p></div>
                        </div>
                      </div>

                      {/* Unified Update Controls */}
                      <div className="w-full lg:w-72 shrink-0 bg-gray-50 rounded-[20px] p-4 border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Update Order</p>
                        <div className="space-y-3">
                          
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Kitchen Status</label>
                            <div className="relative">
                              <select 
                                value={orderStatusDraft[order.id] || order.status} 
                                onChange={(e) => setOrderStatusDraft(p => ({ ...p, [order.id]: e.target.value as Order['status'] }))} 
                                className="w-full bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2.5 text-xs font-bold focus:ring-2 focus:ring-orange-500/20 appearance-none"
                              >
                                {(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'] as Order['status'][]).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Payment Status</label>
                            <div className="relative">
                              <select 
                                value={paymentStatusDraft[order.id] || order.paymentStatus} 
                                onChange={(e) => setPaymentStatusDraft(p => ({ ...p, [order.id]: e.target.value as Order['paymentStatus'] }))} 
                                className="w-full bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2.5 text-xs font-bold focus:ring-2 focus:ring-orange-500/20 appearance-none"
                              >
                                {(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_PAID'] as Order['paymentStatus'][]).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                            </div>
                          </div>

                          {((paymentStatusDraft[order.id] || order.paymentStatus) === 'PARTIALLY_PAID') && (
                            <input 
                              value={paymentAmountDraft[order.id] || ''} 
                              onChange={(e) => setPaymentAmountDraft(p => ({ ...p, [order.id]: e.target.value }))} 
                              placeholder="Paid Amount ₹" 
                              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-orange-500/20" 
                            />
                          )}

                          <button 
                            onClick={() => saveOrderChanges(order)} 
                            disabled={updatingOrderId === order.id}
                            className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-xs font-bold hover:bg-black transition-colors disabled:opacity-50 mt-1"
                          >
                            {updatingOrderId === order.id ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MENU TAB */}
        {activeTab === 'menu' && (
          <>
            {/* Mobile Create Button */}
            <div className="lg:hidden mb-6">
              <button 
                onClick={() => setIsMenuModalOpen(true)}
                className="w-full bg-orange-600 text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95 transition-transform"
              >
                <Plus className="h-5 w-5" />
                Create New Dish
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 animate-in fade-in duration-500">
              
              {/* Desktop Create Dish Sidebar */}
              <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-32">
                <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
                  <h2 className="text-xl font-black text-gray-900 mb-6">Create New Dish</h2>
                  {renderDishForm()}
                </div>
              </div>

              {/* Menu List */}
              <div className="lg:col-span-8 bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-5 sm:mb-8">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-gray-900">Current Menu</h2>
                    <p className="text-xs sm:text-sm font-medium text-gray-500 mt-1">{availableCount} active dishes</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {menuItems.map((item) => (
                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border border-gray-100 hover:border-orange-200 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">{item.name}</h3>
                          <span className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${item.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {item.available ? 'Active' : 'Hidden'}
                          </span>
                        </div>
                        <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">{item.category?.name}</p>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 mt-1 sm:mt-0">
                        <span className="font-black text-base sm:text-lg text-gray-900">{formatInr(item.pricePaise)}</span>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <button onClick={() => toggleAvailability(item)} className={`relative inline-flex h-6 sm:h-7 w-11 sm:w-12 items-center rounded-full transition-colors ${item.available ? 'bg-orange-500' : 'bg-gray-200'}`}>
                            <span className={`inline-block h-4 sm:h-5 w-4 sm:w-5 transform rounded-full bg-white transition-transform ${item.available ? 'translate-x-6 sm:translate-x-6' : 'translate-x-1 sm:translate-x-1.5'}`} />
                          </button>
                          <button onClick={() => removeDish(item)} className="p-2 sm:p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0">
                            <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile Form Modal */}
            {isMenuModalOpen && (
              <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 sm:p-0 animate-in fade-in duration-200 lg:hidden">
                <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 relative">
                  <button 
                    onClick={() => setIsMenuModalOpen(false)}
                    className="absolute top-6 right-6 p-2 bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <h2 className="text-xl font-black text-gray-900 mb-6">Create New Dish</h2>
                  {renderDishForm()}
                </div>
              </div>
            )}
          </>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
            <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 shadow-sm border border-gray-100">
              <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-1 sm:mb-2">Team Management</h2>
              <p className="text-xs sm:text-sm font-medium text-gray-500 mb-6 sm:mb-8">Manage staff access.</p>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8 bg-gray-50 p-3 sm:p-4 rounded-2xl border border-gray-100">
                <input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="employee@email.com" className="w-full sm:flex-1 bg-white border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500/20" />
                <div className="flex gap-3">
                  <div className="relative flex-1 sm:w-32">
                    <select value={userRole} onChange={(e) => setUserRole(e.target.value as 'OWNER' | 'ADMIN' | 'STAFF')} className="w-full bg-white border-none rounded-xl pl-4 pr-8 py-3 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 appearance-none">
                      <option value="STAFF">Staff</option><option value="ADMIN">Admin</option><option value="OWNER">Owner</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                  <button onClick={addRestaurantUser} className="bg-gray-900 text-white font-bold px-4 py-3 rounded-xl hover:bg-black active:scale-95 transition-transform shrink-0">Add</button>
                </div>
              </div>

              <div className="space-y-3">
                {restaurantUsers.map((entry) => (
                  <div key={entry.membershipId} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-gray-100 bg-white gap-3 sm:gap-0">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-500">
                        {entry.user.name?.charAt(0) || 'U'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm sm:text-base truncate">{entry.user.name}</p>
                        <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">{entry.user.email}</p>
                      </div>
                    </div>
                    <span className={`self-start sm:self-auto px-3 py-1 rounded-lg text-[10px] sm:text-xs font-black tracking-widest uppercase ${entry.role === 'OWNER' ? 'bg-purple-100 text-purple-700' : entry.role === 'ADMIN' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>
                      {entry.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === 'payments' && (
          <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500">
            <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 shadow-sm border border-gray-100">
              <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-5 sm:mb-6 flex items-center gap-2"><CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" /> Checkout Policy</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Collection Timing</label>
                  <div className="relative">
                    <select
                      value={paymentPolicy?.paymentCollectionTiming || 'AFTER_MEAL'}
                      onChange={(e) => setPaymentPolicy((p) => ({ paymentCollectionTiming: e.target.value as 'BEFORE_MEAL' | 'AFTER_MEAL', cashPaymentEnabled: p?.cashPaymentEnabled ?? true }))}
                      className="w-full bg-gray-50 border-none rounded-xl pl-4 pr-10 py-4 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 appearance-none"
                    >
                      <option value="BEFORE_MEAL">Collect Before Cooking</option>
                      <option value="AFTER_MEAL">Collect After Meal (Standard)</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                
                <div className="flex items-center p-4 bg-gray-50 rounded-xl mt-0 sm:mt-6">
                  <label className="flex items-center gap-3 cursor-pointer w-full">
                    <div className="relative flex items-center shrink-0">
                      <input type="checkbox" checked={paymentPolicy?.cashPaymentEnabled ?? true} onChange={(e) => setPaymentPolicy((p) => ({ paymentCollectionTiming: p?.paymentCollectionTiming || 'AFTER_MEAL', cashPaymentEnabled: e.target.checked }))} className="peer sr-only" />
                      <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-orange-500 transition-colors"></div>
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                    </div>
                    <span className="font-bold text-gray-700 text-sm sm:text-base">Allow Cash Payments</span>
                  </label>
                </div>
              </div>
              
              <button onClick={savePaymentPolicy} className="mt-6 sm:mt-8 w-full sm:w-auto bg-gray-900 text-white px-8 py-3.5 sm:py-3 rounded-xl font-bold hover:bg-black active:scale-95 transition-transform">Save Settings</button>
            </div>

            <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 shadow-sm border border-gray-100">
              <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-5 sm:mb-6">Cash Approvals</h2>
              {cashOrders.length === 0 ? (
                <div className="bg-gray-50 rounded-2xl p-6 sm:p-8 text-center border border-gray-100 border-dashed">
                  <p className="text-xs sm:text-sm font-bold text-gray-500">No pending collections.</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {cashOrders.map((order) => (
                    <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl border border-gray-100 hover:border-orange-200 transition-all gap-4 sm:gap-0">
                      <div>
                        <p className="font-black text-gray-900 text-base sm:text-lg">#{order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs sm:text-sm font-medium text-gray-500 mt-1">{order.user?.name || 'Walk-in'} • {formatInr(order.totalPaise)}</p>
                      </div>
                      <button
                        onClick={() => confirmCashPayment(order.id)}
                        disabled={confirmingCashOrderId === order.id}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-500 text-white px-5 sm:px-6 py-3 rounded-xl font-bold hover:bg-green-600 active:scale-95 transition-transform disabled:opacity-50 text-sm"
                      >
                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                        {confirmingCashOrderId === order.id ? 'Approving...' : 'Approve Cash'}
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