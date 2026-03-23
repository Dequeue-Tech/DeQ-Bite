import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { auth } from './firebase';

type AuthMode = 'login' | 'register';
type DeliveryStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

type RestaurantSummary = {
  id: string;
  name: string;
  slug: string;
  address?: string;
  city?: string;
  state?: string;
  cuisineTypes?: string[];
};

type MenuItem = {
  id: string;
  name: string;
  description?: string;
  pricePaise: number;
  available: boolean;
  category?: { id: string; name: string };
};

type CartItem = {
  menuItemId: string;
  quantity: number;
  name: string;
  pricePaise: number;
};

type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
};

type DeliveryOrder = {
  id: string;
  totalPaise: number;
  paidAmountPaise?: number;
  dueAmountPaise?: number;
  paymentStatus: string;
  paymentProvider?: string;
  createdAt: string;
  items: Array<{ id: string; quantity: number; menuItem: { name: string } }>;
  deliveryMeta: {
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    landmark?: string;
    riderName?: string;
    riderPhone?: string;
    deliveryStatus: DeliveryStatus;
  };
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

type CouponPreview = {
  coupon: { id: string; code: string; type: 'PERCENT' | 'FIXED'; value: number };
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
};

const formatInr = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format((paise || 0) / 100);

const statusText: Record<DeliveryStatus, string> = {
  PLACED: 'Awaiting restaurant approval',
  CONFIRMED: 'Approved by restaurant',
  PREPARING: 'Preparing your order',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const statusColor: Record<DeliveryStatus, string> = {
  PLACED: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-purple-100 text-purple-800',
  OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const getSlugFromPath = () => {
  const segments = window.location.pathname.split('/').filter(Boolean);
  return segments[0] || '';
};

export default function App() {
  const [apiUrl] = useState((import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, ''));
  const [token, setToken] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [restaurantQuery, setRestaurantQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState('');
  const [selectedRestaurantName, setSelectedRestaurantName] = useState('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [myOrders, setMyOrders] = useState<DeliveryOrder[]>([]);
  const [showOrders, setShowOrders] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', phone: '' });

  const [checkout, setCheckout] = useState({
    customerName: '',
    customerPhone: '',
    deliveryAddress: '',
    landmark: '',
    specialInstructions: '',
    paymentProvider: 'CASH' as 'CASH' | 'RAZORPAY' | 'PAYTM' | 'PHONEPE',
  });

  const previousStatusByOrderRef = useRef<Record<string, DeliveryStatus>>({});

  const hasSlugRoute = Boolean(selectedSlug);
  const cartTotalPaise = useMemo(
    () => cart.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0),
    [cart]
  );
  const estimatedTaxPaise = useMemo(
    () => (couponPreview ? couponPreview.taxPaise : Math.round(cartTotalPaise * 0.08)),
    [couponPreview, cartTotalPaise]
  );
  const discountPaise = useMemo(() => couponPreview?.discountPaise || 0, [couponPreview]);
  const estimatedTotalPaise = useMemo(
    () => (couponPreview ? couponPreview.totalPaise : cartTotalPaise + estimatedTaxPaise),
    [couponPreview, cartTotalPaise, estimatedTaxPaise]
  );

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(selectedSlug ? { 'x-restaurant-slug': selectedSlug } : {}),
    }),
    [token, selectedSlug]
  );

  const tenantUrl = useMemo(() => (selectedSlug ? `${apiUrl}/restaurants/${selectedSlug}` : ''), [apiUrl, selectedSlug]);

  const notify = (nextMessage: string) => {
    setMessage(nextMessage);
    setTimeout(() => setMessage(''), 3500);
  };

  const fetchJson = async <T,>(url: string, init?: RequestInit) => {
    const response = await fetch(url, init);
    const body = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !body.success) {
      throw new Error(body.error || 'Request failed');
    }
    return body.data as T;
  };

  const loadRestaurants = async () => {
    const params = restaurantQuery.trim() ? `?query=${encodeURIComponent(restaurantQuery.trim())}` : '';
    const data = await fetchJson<{ restaurants: RestaurantSummary[] }>(`${apiUrl}/restaurants/public/search${params}`);
    setRestaurants(data.restaurants || []);
  };

  const loadMenu = async (slug: string) => {
    const data = await fetchJson<MenuItem[]>(`${apiUrl}/restaurants/${slug}/menu`, {
      headers: {
        ...authHeaders,
        'x-restaurant-slug': slug,
      },
    });
    setMenuItems(data || []);
  };

  const loadProfile = async (tokenToUse: string, slugForHeader?: string) => {
    const data = await fetchJson<{ user: User }>(`${apiUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${tokenToUse}`,
        ...(slugForHeader ? { 'x-restaurant-slug': slugForHeader } : {}),
      },
    });
    setUser(data.user);
    setCheckout((prev) => ({
      ...prev,
      customerName: prev.customerName || data.user.name || '',
      customerPhone: prev.customerPhone || data.user.phone || '',
    }));
  };

  const loadMyOrders = async (silent = false) => {
    if (!tenantUrl || !token) return;
    if (!silent) setBusy(true);
    try {
      const orders = await fetchJson<DeliveryOrder[]>(`${tenantUrl}/delivery/orders/my`, {
        headers: authHeaders,
      });
      setMyOrders(orders || []);

      const previous = previousStatusByOrderRef.current;
      const next: Record<string, DeliveryStatus> = {};

      orders.forEach((order) => {
        const status = order.deliveryMeta.deliveryStatus;
        next[order.id] = status;
        if (previous[order.id] && previous[order.id] !== status) {
          const msg = `Order #${order.id.slice(0, 8).toUpperCase()} updated: ${statusText[status]}`;
          notify(msg);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Delivery Update', { body: msg });
          }
        }
      });
      previousStatusByOrderRef.current = next;
    } catch (e: any) {
      if (!silent) setError(e?.message || 'Failed to load your orders');
    } finally {
      if (!silent) setBusy(false);
    }
  };

  const onRestaurantSelect = async (restaurant: RestaurantSummary) => {
    const slug = restaurant.slug;
    if (!slug) return;
    window.history.pushState({}, '', `/${slug}`);
    setSelectedSlug(slug);
    setSelectedRestaurantName(restaurant.name);
    setCart([]);
    setShowOrders(false);
    setError('');
    await loadMenu(slug);
    if (token) {
      await loadProfile(token, slug).catch(() => undefined);
      await loadMyOrders(true);
    }
  };

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        return prev.map((i) => (i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { menuItemId: item.id, quantity: 1, name: item.name, pricePaise: item.pricePaise }];
    });
  };

  const updateCartQty = (menuItemId: string, quantity: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.menuItemId === menuItemId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const placeOrder = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!token) {
      setShowAuthModal(true);
      setAuthMode('login');
      return;
    }
    if (!tenantUrl || !selectedSlug) return;
    if (!cart.length) return setError('Cart is empty');
    if (!checkout.customerName || !checkout.customerPhone || !checkout.deliveryAddress) {
      return setError('Customer name, phone, and delivery address are required');
    }

    setBusy(true);
    try {
      await fetchJson(`${tenantUrl}/delivery/orders`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          items: cart.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
          })),
          customerName: checkout.customerName,
          customerPhone: checkout.customerPhone,
          deliveryAddress: checkout.deliveryAddress,
          landmark: checkout.landmark,
          specialInstructions: checkout.specialInstructions,
          paymentProvider: checkout.paymentProvider,
          ...(couponPreview ? { couponCode: couponPreview.coupon.code } : {}),
        }),
      });

      notify('Order placed. Waiting for restaurant approval.');
      setCart([]);
      setCouponCode('');
      setCouponPreview(null);
      setCheckout((prev) => ({ ...prev, specialInstructions: '' }));
      setShowOrders(true);
      await loadMyOrders(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to place order');
    } finally {
      setBusy(false);
    }
  };

  const applyCoupon = async () => {
    if (!tenantUrl) return;
    if (!couponCode.trim()) return setError('Enter a coupon code');
    if (cartTotalPaise <= 0) return setError('Add items before applying coupon');

    setBusy(true);
    setError('');
    try {
      const preview = await fetchJson<CouponPreview>(`${tenantUrl}/coupons/validate`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          code: couponCode.trim(),
          subtotalPaise: cartTotalPaise,
        }),
      });
      setCouponPreview(preview);
      notify(`Coupon ${preview.coupon.code} applied`);
    } catch (e: any) {
      setCouponPreview(null);
      setError(e?.message || 'Failed to apply coupon');
    } finally {
      setBusy(false);
    }
  };

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const credential =
        authMode === 'login'
          ? await signInWithEmailAndPassword(auth, authForm.email, authForm.password)
          : await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);

      if (authMode === 'register' && authForm.name.trim()) {
        await updateProfile(credential.user, { displayName: authForm.name.trim() });
      }

      const idToken = await credential.user.getIdToken();
      await fetchJson<{ user: User }>(`${apiUrl}/auth/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          ...(authMode === 'register' && authForm.name.trim() ? { name: authForm.name.trim() } : {}),
          ...(authForm.phone.trim() ? { phone: authForm.phone.trim() } : {}),
        }),
      });

      const data = await fetchJson<{ user: User }>(`${apiUrl}/auth/me`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
          ...(selectedSlug ? { 'x-restaurant-slug': selectedSlug } : {}),
        },
      });

      localStorage.setItem('auth_token', idToken);
      setToken(idToken);
      setUser(data.user);
      setCheckout((prev) => ({
        ...prev,
        customerName: prev.customerName || data.user.name || '',
        customerPhone: prev.customerPhone || data.user.phone || '',
      }));
      setShowAuthModal(false);
      notify(authMode === 'login' ? 'Logged in successfully' : 'Account created successfully');
      if (selectedSlug) {
        await loadMyOrders(true);
      }
    } catch (e: any) {
      setError(e?.message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('auth_token');
    setToken('');
    setUser(null);
    setMyOrders([]);
    previousStatusByOrderRef.current = {};
    notify('Logged out');
  };

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        const slug = getSlugFromPath();
        const firebaseUser = auth.currentUser;
        const localToken = firebaseUser
          ? await firebaseUser.getIdToken()
          : localStorage.getItem('auth_token') || '';
        setSelectedSlug(slug);
        setToken(localToken);

        await loadRestaurants();

        if (slug) {
          const selected = restaurants.find((r) => r.slug === slug);
          if (selected?.name) setSelectedRestaurantName(selected.name);
          await loadMenu(slug);
        }

        if (localToken) {
          await loadProfile(localToken, slug || undefined).catch(() => undefined);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to initialize app');
      } finally {
        setLoading(false);
      }
    };

    initialize();

    const onPopState = async () => {
      const slug = getSlugFromPath();
      setSelectedSlug(slug);
      setCart([]);
      setShowOrders(false);
      if (!slug) {
        setMenuItems([]);
        return;
      }
      await loadMenu(slug).catch(() => undefined);
      if (token) {
        await loadMyOrders(true);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    loadRestaurants().catch(() => undefined);
  }, [restaurantQuery]);

  useEffect(() => {
    if (!cart.length) {
      setCouponPreview(null);
      return;
    }
    if (couponPreview) {
      setCouponPreview(null);
      notify('Cart changed. Please re-apply coupon.');
    }
  }, [cartTotalPaise]);

  useEffect(() => {
    if (!selectedSlug || !token) return;
    loadMyOrders(true).catch(() => undefined);
    const interval = window.setInterval(() => {
      loadMyOrders(true).catch(() => undefined);
    }, 12000);
    return () => window.clearInterval(interval);
  }, [selectedSlug, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-600 font-semibold">Loading Delivery App...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900">Restaurant Delivery</h1>
            <p className="text-xs text-slate-500">{hasSlugRoute ? `/${selectedSlug}` : 'Choose a restaurant to start'}</p>
          </div>
          <div className="flex gap-2 items-center">
            {'Notification' in window && Notification.permission !== 'granted' && (
              <button
                onClick={async () => {
                  const p = await Notification.requestPermission();
                  if (p === 'granted') notify('App notifications enabled');
                }}
                className="px-3 py-2 rounded-lg bg-slate-200 text-xs font-bold"
              >
                Enable Notifications
              </button>
            )}
            {user ? (
              <>
                <span className="text-xs font-semibold text-slate-700">{user.name}</span>
                <button onClick={logout} className="px-3 py-2 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold">
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setShowAuthModal(true);
                  setAuthMode('login');
                }}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold"
              >
                Login / Signup
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {error && <div className="p-3 rounded-lg bg-rose-100 text-rose-800 text-sm">{error}</div>}
        {message && <div className="p-3 rounded-lg bg-emerald-100 text-emerald-800 text-sm">{message}</div>}

        {!hasSlugRoute && (
          <section className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">All Restaurants</h2>
              <input
                value={restaurantQuery}
                onChange={(e) => setRestaurantQuery(e.target.value)}
                placeholder="Search restaurants..."
                className="w-full sm:w-80 border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {restaurants.map((restaurant) => (
                <button
                  key={restaurant.id}
                  onClick={() => onRestaurantSelect(restaurant)}
                  className="text-left border border-slate-200 rounded-xl p-4 hover:border-emerald-400 hover:bg-emerald-50 transition"
                >
                  <p className="font-bold text-slate-900">{restaurant.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {[restaurant.city, restaurant.state].filter(Boolean).join(', ') || restaurant.address || 'Location unavailable'}
                  </p>
                  <p className="text-xs text-emerald-700 mt-2 font-semibold">Open Menu</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {hasSlugRoute && (
          <div className="grid lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <div className="flex justify-between gap-3 items-center">
                  <h2 className="text-lg font-bold text-slate-900">
                    {selectedRestaurantName || selectedSlug} Menu
                  </h2>
                  <button
                    onClick={() => {
                      window.history.pushState({}, '', '/');
                      setSelectedSlug('');
                      setSelectedRestaurantName('');
                      setMenuItems([]);
                      setCart([]);
                      setMyOrders([]);
                      previousStatusByOrderRef.current = {};
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-200 text-xs font-bold"
                  >
                    Change Restaurant
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 mt-4">
                  {menuItems.map((item) => (
                    <div key={item.id} className="border border-slate-200 rounded-xl p-3">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{item.description || 'No description available'}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="font-bold text-slate-800">{formatInr(item.pricePaise)}</span>
                        <button
                          onClick={() => addToCart(item)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">My Delivery Orders</h3>
                  <button
                    onClick={() => {
                      setShowOrders((prev) => !prev);
                      if (!showOrders) loadMyOrders().catch(() => undefined);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-200 text-xs font-bold"
                  >
                    {showOrders ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showOrders && (
                  <div className="space-y-3 mt-4">
                    {myOrders.length === 0 ? (
                      <p className="text-sm text-slate-500">No delivery orders yet.</p>
                    ) : (
                      myOrders.map((order) => (
                        <div key={order.id} className="border border-slate-200 rounded-xl p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-slate-900">#{order.id.slice(0, 8).toUpperCase()}</p>
                            <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${statusColor[order.deliveryMeta.deliveryStatus]}`}>
                              {statusText[order.deliveryMeta.deliveryStatus]}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-2">Placed: {new Date(order.createdAt).toLocaleString('en-IN')}</p>
                          <p className="text-sm font-semibold text-slate-800 mt-1">Total: {formatInr(order.totalPaise)}</p>
                          {order.deliveryMeta.riderName && (
                            <p className="text-xs text-slate-600 mt-1">
                              Rider: {order.deliveryMeta.riderName} ({order.deliveryMeta.riderPhone || 'NA'})
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-4">
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-3">Cart</h3>
                {cart.length === 0 ? (
                  <p className="text-sm text-slate-500">Add items to your cart.</p>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.menuItemId} className="border border-slate-200 rounded-lg p-2">
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-slate-600">{formatInr(item.pricePaise)}</span>
                          <input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={(e) => updateCartQty(item.menuItemId, Number(e.target.value))}
                            className="w-20 border border-slate-300 rounded px-2 py-1 text-sm"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-slate-200 space-y-1">
                      <p className="text-sm font-semibold text-slate-700">Subtotal: {formatInr(cartTotalPaise)}</p>
                      <p className="text-sm font-semibold text-slate-700">Discount: -{formatInr(discountPaise)}</p>
                      <p className="text-sm font-semibold text-slate-700">Tax: {formatInr(estimatedTaxPaise)}</p>
                      <p className="text-sm font-bold text-slate-900">Total: {formatInr(estimatedTotalPaise)}</p>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={placeOrder} className="bg-white rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-lg font-bold text-slate-900">Checkout</h3>
                <input
                  value={checkout.customerName}
                  onChange={(e) => setCheckout((prev) => ({ ...prev, customerName: e.target.value }))}
                  placeholder="Customer name"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
                <input
                  value={checkout.customerPhone}
                  onChange={(e) => setCheckout((prev) => ({ ...prev, customerPhone: e.target.value }))}
                  placeholder="Phone number"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
                <textarea
                  value={checkout.deliveryAddress}
                  onChange={(e) => setCheckout((prev) => ({ ...prev, deliveryAddress: e.target.value }))}
                  placeholder="Delivery location / full address"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  rows={2}
                  required
                />
                <input
                  value={checkout.landmark}
                  onChange={(e) => setCheckout((prev) => ({ ...prev, landmark: e.target.value }))}
                  placeholder="Landmark (optional)"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
                <textarea
                  value={checkout.specialInstructions}
                  onChange={(e) => setCheckout((prev) => ({ ...prev, specialInstructions: e.target.value }))}
                  placeholder="Special instructions"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  rows={2}
                />
                <select
                  value={checkout.paymentProvider}
                  onChange={(e) =>
                    setCheckout((prev) => ({
                      ...prev,
                      paymentProvider: e.target.value as 'CASH' | 'RAZORPAY' | 'PAYTM' | 'PHONEPE',
                    }))
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  <option value="CASH">Cash</option>
                  <option value="RAZORPAY">Razorpay</option>
                  <option value="PAYTM">Paytm</option>
                  <option value="PHONEPE">PhonePe</option>
                </select>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600">Apply Coupon</label>
                  <div className="flex gap-2">
                    <input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Coupon code"
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={busy || !couponCode.trim()}
                      className="px-3 py-2 rounded-lg bg-slate-200 text-xs font-bold disabled:opacity-60"
                    >
                      Apply
                    </button>
                  </div>
                  {couponPreview && (
                    <p className="text-xs text-emerald-700 font-semibold">
                      Applied: {couponPreview.coupon.code} (-{formatInr(couponPreview.discountPaise)})
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-60"
                >
                  {busy ? 'Processing...' : 'Place Delivery Order'}
                </button>
                <p className="text-xs text-slate-500">
                  Your order will be placed in <strong>PLACED</strong> state and must be approved by the restaurant first.
                </p>
              </form>
            </aside>
          </div>
        )}
      </div>

      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-900/50 p-4 flex items-center justify-center z-50">
          <form onSubmit={submitAuth} className="w-full max-w-md bg-white rounded-xl p-5 space-y-3">
            <h3 className="text-lg font-bold text-slate-900">
              {authMode === 'login' ? 'Login' : 'Create Account'}
            </h3>
            {authMode === 'register' && (
              <input
                value={authForm.name}
                onChange={(e) => setAuthForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Full name"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                required
              />
            )}
            <input
              type="email"
              value={authForm.email}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              required
            />
            {authMode === 'register' && (
              <input
                value={authForm.phone}
                onChange={(e) => setAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            )}
            <input
              type="password"
              value={authForm.password}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Password"
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              required
            />
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-bold">
              {busy ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Create Account'}
            </button>
            <button
              type="button"
              onClick={() => setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'))}
              className="w-full py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold"
            >
              {authMode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
            </button>
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="w-full py-2 rounded-lg text-slate-500 text-sm"
            >
              Close
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
