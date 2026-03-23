'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Store, Search, ShoppingBag, MapPin, 
  CreditCard, ChevronRight, User, LogOut, 
  BellRing, X, Plus, Minus, Receipt, CheckCircle, 
  Clock, ArrowLeft, Ticket 
} from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Types ---
type AuthMode = 'login' | 'register';
type DeliveryStatus = 'PLACED' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

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
  image?: string | null; 
  category?: { id: string; name: string };
};

type CartItem = {
  menuItemId: string;
  quantity: number;
  name: string;
  pricePaise: number;
};

type UserType = {
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

// --- Formatters & Constants ---
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
  PLACED: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  PREPARING: 'bg-purple-100 text-purple-800 border-purple-200',
  OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-800 border-orange-200',
  DELIVERED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
};

const getSlugFromPath = () => {
  if (typeof window === 'undefined') return '';
  const segments = window.location.pathname.split('/').filter(Boolean);
  return segments[0] || '';
};

// --- Main Component ---
export default function App() {
  const [apiUrl] = useState((import.meta.env?.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, ''));
  const [token, setToken] = useState<string>('');
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [restaurantQuery, setRestaurantQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState('');
  const [selectedRestaurantName, setSelectedRestaurantName] = useState('');
  
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showMobileCart, setShowMobileCart] = useState(false); // Mobile cart drawer state
  
  const [myOrders, setMyOrders] = useState<DeliveryOrder[]>([]);
  const [showOrders, setShowOrders] = useState(false);
  
  const [couponCode, setCouponCode] = useState('');
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [couponError, setCouponError] = useState(''); // Local error for coupon input

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', phone: '' });

  const [checkout, setCheckout] = useState({
    customerName: '',
    customerPhone: '',
    deliveryAddress: '',
    landmark: '',
    specialInstructions: '',
  });
  
  // Invoice state replaces payment providers
  const [requestInvoice, setRequestInvoice] = useState(true);

  const previousStatusByOrderRef = useRef<Record<string, DeliveryStatus>>({});

  const hasSlugRoute = Boolean(selectedSlug);
  
  const cartTotalPaise = useMemo(
    () => cart.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0),
    [cart]
  );

  const totalCartItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
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

  // Derived logic for Categories
  const uniqueCategories = useMemo(() => {
    const cats = new Set(menuItems.map(item => item.category?.name).filter(Boolean) as string[]);
    return ['All', ...Array.from(cats)];
  }, [menuItems]);

  const filteredMenuItems = useMemo(() => {
    if (activeCategory === 'All') return menuItems;
    return menuItems.filter(item => item.category?.name === activeCategory);
  }, [menuItems, activeCategory]);

  // Prevents background scrolling when mobile cart is open
  useEffect(() => {
    if (showMobileCart) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [showMobileCart]);

  // --- Actions ---
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
    const data = await fetchJson<{ user: UserType }>(`${apiUrl}/auth/me`, {
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
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
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
    setActiveCategory('All');
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
          paymentProvider: 'CASH', // Always CASH for Invoice flow
          ...(couponPreview ? { couponCode: couponPreview.coupon.code } : {}),
        }),
      });

      notify('Order placed. Waiting for restaurant approval.');
      setCart([]);
      setCouponCode('');
      setCouponPreview(null);
      setCheckout((prev) => ({ ...prev, specialInstructions: '' }));
      setShowOrders(true);
      setShowMobileCart(false); // Close mobile cart automatically
      await loadMyOrders(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to place order');
    } finally {
      setBusy(false);
    }
  };

  const applyCoupon = async () => {
    if (!tenantUrl) return;
    if (!couponCode.trim()) return setCouponError('Enter a coupon code');
    if (cartTotalPaise <= 0) return setCouponError('Add items before applying coupon');

    setBusy(true);
    setCouponError('');
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
      
      // Fire Confetti!
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.7, x: typeof window !== 'undefined' && window.innerWidth > 1024 ? 0.85 : 0.5 },
        colors: ['#ea580c', '#fbbf24', '#ffffff']
      });

    } catch (e: any) {
      setCouponPreview(null);
      setCouponError(e?.message || 'Failed to apply coupon');
    } finally {
      setBusy(false);
    }
  };

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const payload =
        authMode === 'login'
          ? { email: authForm.email, password: authForm.password }
          : {
              name: authForm.name,
              email: authForm.email,
              phone: authForm.phone,
              password: authForm.password,
            };

      const data = await fetchJson<{ user: UserType; token: string }>(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
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

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken('');
    setUser(null);
    setMyOrders([]);
    previousStatusByOrderRef.current = {};
    notify('Logged out');
  };

  // --- Effects ---
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        const slug = getSlugFromPath();
        const localToken = localStorage.getItem('auth_token') || '';
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
      setActiveCategory('All');
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

  // --- Renders ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-bold text-sm tracking-wide">Loading Delivery App...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] pb-24 relative">
      {/* High-End Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2 sm:p-2.5 rounded-xl text-white shadow-lg shadow-orange-500/20 shrink-0">
              <Store className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight leading-none">Bite Delivery</h1>
              <p className="text-[10px] sm:text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest truncate max-w-[150px] sm:max-w-full">
                {hasSlugRoute ? `@${selectedSlug}` : 'Select a location'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile Cart Toggle */}
            {hasSlugRoute && (
              <button
                onClick={() => setShowMobileCart(true)}
                className="lg:hidden relative p-2 sm:p-2.5 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
              >
                <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" />
                {totalCartItems > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                    {totalCartItems}
                  </span>
                )}
              </button>
            )}
            
            {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
              <button
                onClick={async () => {
                  const p = await Notification.requestPermission();
                  if (p === 'granted') notify('App notifications enabled');
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-50 text-orange-700 text-xs font-bold hover:bg-orange-100 transition-colors"
              >
                <BellRing className="h-3.5 w-3.5" />
                Alerts
              </button>
            )}
            
            {user ? (
              <div className="flex items-center gap-3 bg-gray-50 px-2 sm:px-3 py-1.5 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="h-3 w-3 text-gray-500" />
                  </div>
                  <span className="hidden sm:block text-xs font-black text-gray-700">{user.name}</span>
                </div>
                <div className="w-px h-4 bg-gray-200 hidden sm:block" />
                <button onClick={logout} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Logout">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setShowAuthModal(true); setAuthMode('login'); }}
                className="px-4 py-2 sm:py-2.5 rounded-xl bg-gray-900 text-white text-xs sm:text-sm font-bold shadow-md hover:bg-black active:scale-95 transition-all"
              >
                Login / Sign Up
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Floating Notifications */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
        {error && (
          <div className="bg-red-500/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-xl flex items-start gap-3 pointer-events-auto animate-in slide-in-from-top-4">
            <button onClick={() => setError('')} className="shrink-0 p-1 hover:bg-red-600 rounded-full transition-colors mt-0.5">
              <X className="h-4 w-4" />
            </button>
            <p className="text-sm font-bold flex-1">{error}</p>
          </div>
        )}
        {message && (
          <div className="bg-gray-900/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-xl flex items-start gap-3 pointer-events-auto animate-in slide-in-from-top-4">
            <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
            <p className="text-sm font-bold flex-1">{message}</p>
            <button onClick={() => setMessage('')} className="shrink-0 p-1 hover:bg-gray-800 rounded-full transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* State 1: Select Restaurant */}
        {!hasSlugRoute && (
          <div className="animate-in fade-in duration-500">
            <div className="flex flex-col items-center text-center mb-8 sm:mb-12 mt-4 sm:mt-10">
              <h2 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight mb-4">Craving something?</h2>
              <p className="text-gray-500 font-medium max-w-md mx-auto">Choose from our list of premium partner restaurants and get it delivered hot and fresh.</p>
              
              <div className="relative w-full max-w-lg mt-8">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  value={restaurantQuery}
                  onChange={(e) => setRestaurantQuery(e.target.value)}
                  placeholder="Search restaurants..."
                  className="w-full bg-white border border-gray-200 rounded-[24px] py-4 pl-14 pr-6 text-sm font-bold focus:ring-4 focus:ring-orange-500/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {restaurants.map((restaurant) => (
                <button
                  key={restaurant.id}
                  onClick={() => onRestaurantSelect(restaurant)}
                  className="bg-white rounded-[32px] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 hover:border-orange-200 hover:shadow-[0_8px_30px_rgb(234,88,12,0.08)] transition-all text-left flex flex-col h-full group"
                >
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-gray-900 mb-2">{restaurant.name}</h3>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {[restaurant.city, restaurant.state].filter(Boolean).join(', ') || restaurant.address || 'Location unavailable'}
                    </p>
                  </div>
                  <div className="flex items-center text-sm font-bold text-orange-600 group-hover:translate-x-1 transition-transform mt-4">
                    View Menu <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* State 2: Inside a Restaurant */}
        {hasSlugRoute && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            
            {/* Left Column: Menu & Past Orders */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
              
              {/* Back & Title Header */}
              <div className="bg-white rounded-[32px] p-5 sm:p-8 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
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
                      className="flex items-center text-xs font-bold text-gray-400 hover:text-gray-900 uppercase tracking-widest mb-3 transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Change Restaurant
                    </button>
                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
                      {selectedRestaurantName || selectedSlug} Menu
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setShowOrders((prev) => !prev);
                      if (!showOrders) loadMyOrders().catch(() => undefined);
                    }}
                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all border-2 ${
                      showOrders ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-900'
                    }`}
                  >
                    <Receipt className="h-4 w-4" />
                    {showOrders ? 'Hide Orders' : 'My Orders'}
                  </button>
                </div>

                {/* Orders View */}
                {showOrders && (
                  <div className="mt-8 pt-8 border-t border-dashed border-gray-200 animate-in fade-in duration-300">
                    <h3 className="text-lg font-black text-gray-900 mb-4">Track Deliveries</h3>
                    {myOrders.length === 0 ? (
                      <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100">
                        <ShoppingBag className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-bold text-gray-500">No delivery orders yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {myOrders.map((order) => (
                          <div key={order.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:border-orange-200 transition-colors">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                              <p className="font-black text-lg text-gray-900">#{order.id.slice(0, 8).toUpperCase()}</p>
                              <span className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border ${statusColor[order.deliveryMeta.deliveryStatus]}`}>
                                {statusText[order.deliveryMeta.deliveryStatus]}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {new Date(order.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                              <span className="flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> {order.paymentStatus}</span>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                               <p className="text-xl font-black text-gray-900">{formatInr(order.totalPaise)}</p>
                               {order.deliveryMeta.riderName ? (
                                  <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rider Assigned</p>
                                    <p className="text-sm font-bold text-gray-800">{order.deliveryMeta.riderName} • {order.deliveryMeta.riderPhone}</p>
                                  </div>
                                ) : (
                                  <p className="text-xs font-bold text-gray-500">Waiting for rider assignment</p>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Horizontal Category Pills */}
              {uniqueCategories.length > 1 && (
                <div className="mt-6 mb-2 relative">
                  <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <style dangerouslySetInnerHTML={{ __html: `.no-scrollbar::-webkit-scrollbar { display: none; }`}} />
                    {uniqueCategories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-5 py-2.5 rounded-full text-sm font-black whitespace-nowrap transition-all active:scale-95 ${
                          activeCategory === cat
                            ? 'bg-gray-900 text-white shadow-md'
                            : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-900 hover:text-gray-900'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Filtered Menu Grid with Side Images */}
              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 mt-4">
                {filteredMenuItems.map((item) => {
                  const cartItem = cart.find(c => c.menuItemId === item.id);
                  return (
                    <div key={item.id} className="bg-white rounded-[28px] p-4 sm:p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 flex flex-col justify-between h-full hover:border-orange-200 transition-colors">
                      
                      {/* Top Section: Text Info (Left) + Image (Right) */}
                      <div className="flex justify-between gap-4 mb-4">
                        
                        {/* Text Info */}
                        <div className="flex-1 flex flex-col">
                          <div className="flex items-start gap-2 mb-1.5">
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${item.available ? 'bg-green-500' : 'bg-gray-300'}`} title={item.available ? 'Available' : 'Out of stock'} />
                            <h3 className="font-black text-gray-900 text-base sm:text-lg leading-tight">{item.name}</h3>
                          </div>
                          
                          {item.category?.name && (
                            <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1.5 ml-4">
                              {item.category.name}
                            </p>
                          )}
                          
                          <p className="text-xs sm:text-sm text-gray-500 font-medium line-clamp-2 ml-4">
                            {item.description}
                          </p>
                        </div>

                        {/* High-End Side Image Block */}
                        {item.image && (
                          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-[20px] overflow-hidden bg-gray-50 shrink-0 border border-gray-100 shadow-sm">
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" 
                              loading="lazy"
                            />
                          </div>
                        )}
                      </div>
                      
                      {/* Bottom Section: Price & Action Buttons */}
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                        <span className="font-black text-xl text-gray-900">{formatInr(item.pricePaise)}</span>
                        
                        {cartItem ? (
                           <div className="flex items-center gap-3 bg-gray-100 rounded-xl p-1">
                             <button onClick={() => updateCartQty(item.id, cartItem.quantity - 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-700 hover:text-red-500 transition-colors"><Minus className="h-4 w-4" /></button>
                             <span className="font-black text-sm w-4 text-center">{cartItem.quantity}</span>
                             <button onClick={() => addToCart(item)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-700 hover:text-green-500 transition-colors"><Plus className="h-4 w-4" /></button>
                           </div>
                        ) : (
                          <button
                            onClick={() => addToCart(item)}
                            disabled={!item.available}
                            className="bg-gray-900 text-white rounded-xl px-6 py-2.5 font-bold text-sm shadow-md hover:bg-black active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {filteredMenuItems.length === 0 && (
                  <div className="col-span-full py-10 text-center">
                    <p className="text-gray-400 font-bold">No items found in this category.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Checkout Sidebar / Mobile Drawer */}
            {/* Mobile Drawer Overlay */}
            {showMobileCart && (
              <div 
                className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
                onClick={() => setShowMobileCart(false)}
              />
            )}

            <div className={`
              fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] h-full flex flex-col transition-transform duration-300 ease-in-out
              ${showMobileCart ? 'translate-x-0' : 'translate-x-full'}
              lg:relative lg:translate-x-0 lg:z-auto lg:w-auto lg:h-auto lg:block lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24
            `}>
              <div className="bg-white lg:rounded-[32px] shadow-2xl lg:shadow-[0_8px_30px_rgb(0,0,0,0.08)] lg:border border-gray-100 overflow-hidden flex flex-col h-full lg:max-h-[85vh]">
                
                <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
                  <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-orange-600" /> Your Cart
                  </h3>
                  <button 
                    onClick={() => setShowMobileCart(false)}
                    className="lg:hidden p-2 bg-white rounded-full border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                   <style dangerouslySetInnerHTML={{ __html: `.no-scrollbar::-webkit-scrollbar { display: none; }`}} />

                  {cart.length === 0 ? (
                    <div className="text-center py-10 opacity-50">
                      <ShoppingBag className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-sm font-bold text-gray-500">Cart is empty</p>
                    </div>
                  ) : (
                    <div className="space-y-4 mb-8">
                      {cart.map((item) => (
                        <div key={item.menuItemId} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-3">
                            <div className="bg-gray-100 px-2 py-1 rounded-lg text-xs font-black text-gray-500 shrink-0">{item.quantity}x</div>
                            <p className="font-bold text-gray-800 line-clamp-1">{item.name}</p>
                          </div>
                          <span className="font-black shrink-0">{formatInr(item.pricePaise * item.quantity)}</span>
                        </div>
                      ))}
                      
                      <div className="border-t border-dashed border-gray-200 pt-4 space-y-2 text-sm">
                        <div className="flex justify-between text-gray-500 font-medium"><span>Subtotal</span><span>{formatInr(cartTotalPaise)}</span></div>
                        {discountPaise > 0 && <div className="flex justify-between text-green-500 font-bold"><span>Discount</span><span>-{formatInr(discountPaise)}</span></div>}
                        <div className="flex justify-between text-gray-500 font-medium"><span>Tax</span><span>{formatInr(estimatedTaxPaise)}</span></div>
                      </div>
                    </div>
                  )}

                  {/* Checkout Form */}
                  <form id="checkout-form" onSubmit={placeOrder} className="space-y-4 pt-4 border-t border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Delivery Details</p>
                    
                    <div className="space-y-3">
                      <input
                        value={checkout.customerName}
                        onChange={(e) => setCheckout((prev) => ({ ...prev, customerName: e.target.value }))}
                        placeholder="Full Name"
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-orange-500/20"
                        required
                      />
                      <input
                        value={checkout.customerPhone}
                        onChange={(e) => setCheckout((prev) => ({ ...prev, customerPhone: e.target.value }))}
                        placeholder="Phone Number"
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-orange-500/20"
                        required
                      />
                      <textarea
                        value={checkout.deliveryAddress}
                        onChange={(e) => setCheckout((prev) => ({ ...prev, deliveryAddress: e.target.value }))}
                        placeholder="Full Delivery Address"
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 resize-none"
                        rows={2}
                        required
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          value={checkout.landmark}
                          onChange={(e) => setCheckout((prev) => ({ ...prev, landmark: e.target.value }))}
                          placeholder="Landmark"
                          className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-orange-500/20"
                        />
                        <input
                          value={checkout.specialInstructions}
                          onChange={(e) => setCheckout((prev) => ({ ...prev, specialInstructions: e.target.value }))}
                          placeholder="Cooking Notes"
                          className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-orange-500/20"
                        />
                      </div>
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-6 mb-2">Checkout Method</p>
                    
                    {/* Replaced Payment Provider Map with Invoice Toggle */}
                    <label
                      className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                        requestInvoice
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={requestInvoice}
                        onChange={(e) => setRequestInvoice(e.target.checked)}
                        className="sr-only"
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-base sm:text-lg">Ask for Invoice</span>
                        <span className={`text-xs sm:text-sm mt-0.5 font-medium ${requestInvoice ? 'text-gray-300' : 'text-gray-500'}`}>
                          Bill will be brought to your table
                        </span>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${requestInvoice ? 'border-white' : 'border-gray-300'}`}>
                        {requestInvoice && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </label>

                    <div className="mt-4">
                      <div className="relative">
                        <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          value={couponCode}
                          onChange={(e) => {
                            setCouponCode(e.target.value.toUpperCase());
                            setCouponError(''); 
                          }}
                          placeholder="PROMO CODE"
                          className={`w-full bg-gray-50 border-2 rounded-2xl py-4 pl-12 pr-24 text-xs font-black tracking-widest transition-colors ${
                            couponError ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : 'border-transparent focus:ring-2 focus:ring-orange-500/20'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={applyCoupon}
                          disabled={busy || !couponCode.trim()}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[10px] font-black px-4 py-2 rounded-xl disabled:opacity-50 transition-all active:scale-95"
                        >
                          APPLY
                        </button>
                      </div>
                      
                      {/* Local Coupon Error */}
                      {couponError && (
                        <p className="text-xs font-bold text-red-500 mt-2 ml-2 animate-in slide-in-from-top-1">
                          {couponError}
                        </p>
                      )}
                      
                      {/* Coupon Success Info */}
                      {couponPreview && (
                        <p className="text-xs font-bold text-green-600 mt-2 ml-2 animate-in slide-in-from-top-1">
                          Applied: {couponPreview.coupon.code} (-{formatInr(couponPreview.discountPaise)})
                        </p>
                      )}
                    </div>
                  </form>
                </div>

                {/* Footer Action */}
                <div className="p-6 bg-white border-t border-gray-100 shrink-0">
                   <div className="flex justify-between items-center mb-4">
                      <span className="text-gray-500 font-bold uppercase tracking-widest text-xs">Total Due</span>
                      <span className="text-2xl font-black text-gray-900">{formatInr(estimatedTotalPaise)}</span>
                   </div>
                   <button
                    form="checkout-form"
                    type="submit"
                    disabled={busy || cart.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-orange-600 text-white rounded-2xl font-black text-base shadow-xl shadow-orange-500/20 hover:bg-orange-700 active:scale-[0.98] transition-all disabled:bg-gray-200 disabled:shadow-none disabled:text-gray-400"
                  >
                    {busy ? 'Processing...' : 'Place Order'}
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modern Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm p-4 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <form onSubmit={submitAuth} className="w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 relative">
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="absolute top-6 right-6 p-2 bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-6">
              <User className="h-6 w-6 text-orange-600" />
            </div>
            
            <h3 className="text-2xl font-black text-gray-900 mb-1">
              {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h3>
            <p className="text-sm font-medium text-gray-500 mb-8">
              {authMode === 'login' ? 'Login to continue your order' : 'Sign up to place your delivery order'}
            </p>

            <div className="space-y-3">
              {authMode === 'register' && (
                <input
                  value={authForm.name}
                  onChange={(e) => setAuthForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Full Name"
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-orange-500/20"
                  required
                />
              )}
              <input
                type="email"
                value={authForm.email}
                onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email Address"
                className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-orange-500/20"
                required
              />
              {authMode === 'register' && (
                <input
                  value={authForm.phone}
                  onChange={(e) => setAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone Number"
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-orange-500/20"
                />
              )}
              <input
                type="password"
                value={authForm.password}
                onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Password"
                className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-orange-500/20"
                required
              />
            </div>

            <button type="submit" disabled={busy} className="w-full py-4 mt-6 rounded-2xl bg-gray-900 text-white font-black shadow-lg hover:bg-black active:scale-95 transition-all">
              {busy ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Sign Up'}
            </button>
            
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'))}
                className="text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
              >
                {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Login'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}