'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { apiClient, MenuItem, Category } from '@/lib/api-client';
import { ChefHat, Search, Menu as MenuIcon, X } from 'lucide-react';
import { useCartStore, CartItem } from '@/store/cart';
import { formatInr } from '@/lib/currency';
import toast from 'react-hot-toast';

const MenuItemsSection = dynamic(() => import('./MenuItemsSection'), {
  loading: () => <MenuItemsSkeleton />,
});

function MenuItemsSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1].map((section) => (
        <div key={section}>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-5 w-28 rounded bg-gray-200 animate-pulse" />
            <div className="flex-1 h-px bg-gray-200" />
            <div className="h-4 w-16 rounded bg-gray-200 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[0, 1, 2].map((card) => (
              <div
                key={card}
                className="bg-white rounded-lg shadow-md overflow-hidden"
              >
                <div className="p-3 sm:p-4">
                  <div className="flex gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="h-3 w-20 rounded bg-gray-200 animate-pulse mb-2" />
                      <div className="h-4 w-3/4 rounded bg-gray-200 animate-pulse mb-2" />
                      <div className="h-3 w-full rounded bg-gray-200 animate-pulse mb-2" />
                      <div className="h-3 w-5/6 rounded bg-gray-200 animate-pulse mb-3" />
                      <div className="h-5 w-24 rounded bg-gray-200 animate-pulse" />
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-gray-200 animate-pulse" />
                      <div className="h-7 w-16 sm:w-20 rounded bg-gray-200 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MenuPageSkeleton() {
  return (
    <div className="min-h-screen mb-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-4 sm:mb-8">
          <div className="h-6 w-32 sm:w-40 rounded bg-gray-200 animate-pulse mb-3" />
          <div className="h-3 w-56 rounded bg-gray-200 animate-pulse" />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6 sticky top-14 mt-2 bg-gray-50 py-2 z-40 shadow">
          <div className="relative flex-grow">
            <div className="h-10 w-full rounded-lg bg-gray-200 animate-pulse" />
          </div>
        </div>

        <MenuItemsSkeleton />
      </div>
    </div>
  );
}

function MenuPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const { items, addItem, removeItem, updateQuantity, setActiveOrderId } = useCartStore();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // Filters
  const [filters] = useState({
    isVeg: false,
    isVegan: false,
    isGlutenFree: false,
    spiceLevel: 'all',
  });
  const [showCategoriesPanel, setShowCategoriesPanel] = useState(false);
  const hasShownFirstAddToast = useRef(false);

  useEffect(() => {
    const slug = apiClient.getSelectedRestaurantSlug() || apiClient.getActiveRestaurantSlug();
    if (slug) {
      apiClient.setSelectedRestaurantSlug(slug);
    }
    setSelectedSlug(slug);
    setActiveOrderId(searchParams.get('orderId'));
    fetchMenuData(slug);
  }, [searchParams, setActiveOrderId]);

  const fetchMenuData = async (slugOverride?: string | null) => {
    try {
      const slugKey = slugOverride || selectedSlug || 'default';
      const cacheKey = `menu_cache_${slugKey}`;
      const cacheRaw = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;
      const cacheTsRaw = typeof window !== 'undefined' ? sessionStorage.getItem(`${cacheKey}_ts`) : null;
      const cacheTs = cacheTsRaw ? Number(cacheTsRaw) : 0;
      const hasFreshCache = cacheRaw && cacheTs && Date.now() - cacheTs < 60_000;

      if (hasFreshCache) {
        try {
          const cached = JSON.parse(cacheRaw);
          if (Array.isArray(cached.menuItems)) setMenuItems(cached.menuItems);
          if (Array.isArray(cached.categories)) setCategories(cached.categories);
          setLoading(false);
        } catch {
          // ignore cache parse errors
        }
      } else {
        setLoading(true);
      }

      setError(null);

      const [menuResponse, categoriesResponse] = await Promise.all([
        apiClient.getMenuItems(),
        apiClient.getCategories(),
      ]).catch(err => {
        throw err;
      });

      // Passing the exact DB data through directly without overrides
      if (menuResponse && menuResponse.success && Array.isArray(menuResponse.data)) {
        setMenuItems(menuResponse.data);
      } else {
        setMenuItems([]);
      }

      if (categoriesResponse && categoriesResponse.success && Array.isArray(categoriesResponse.data)) {
        setCategories(categoriesResponse.data);
      } else {
        setCategories([]);
      }

      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({
              menuItems: menuResponse?.data || [],
              categories: categoriesResponse?.data || [],
            }),
          );
          sessionStorage.setItem(`${cacheKey}_ts`, String(Date.now()));
        } catch {
          // ignore cache set errors
        }
      }
    } catch (err) {
      setError('Failed to load menu: ' + (err instanceof Error ? err.message : 'Unknown error'));
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = menuItems.filter(item => {
    // Category filter
    if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) {
      return false;
    }

    // Search filter
    if (searchTerm && !item.name?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Dietary filters
    if (filters.isVeg && !item.isVeg) return false;
    if (filters.isVegan && !item.isVegan) return false;
    if (filters.isGlutenFree && !item.isGlutenFree) return false;
    if (filters.spiceLevel !== 'all' && item.spiceLevel !== filters.spiceLevel) return false;

    return item.available;
  });

  const handleAddToCart = (item: MenuItem) => {
    if (!isAuthenticated) {
      toast.error('Please sign in to add items to cart');
      router.push('/auth/signin');
      return;
    }

    try {
      addItem({
        id: item.id,
        name: item.name || '',
        pricePaise: item.pricePaise,
        image: item.image, // Properly pushes the DB image (or null) to the cart
        quantity: 1,
      });

      const isFirstAddToast = !hasShownFirstAddToast.current;
      if (isFirstAddToast) {
        hasShownFirstAddToast.current = true;
      }

      toast.success(
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{item.name || 'Item'}</span>
          <span className="text-gray-600 text-sm">added</span>
          <span className="bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
            {formatInr(item.pricePaise)}
          </span>
        </div>,
        {
          duration: 1500,
          position: 'top-center',
          style: {
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0,0,0,0.05)',
            padding: '8px 16px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          },
        }
      );
    } catch (err) {
      console.error('Error adding item to cart:', err);
      toast.error('Failed to add item to cart');
    }
  };

  const handleUpdateQuantity = (item: MenuItem, newQuantity: number) => {
    if (!isAuthenticated) {
      toast.error('Please sign in to update cart items');
      router.push('/auth/signin');
      return;
    }

    try {
      if (newQuantity <= 0) {
        removeItem(item.id);
      } else {
        updateQuantity(item.id, newQuantity);
      }
    } catch (err) {
      console.error('Error updating item quantity:', err);
      toast.error('Failed to update item quantity');
    }
  };

  const getCartItemQuantity = (itemId: string) => {
    const cartItem = items.find((cartItem: CartItem) => cartItem.id === itemId);
    return cartItem ? cartItem.quantity : 0;
  };

  const getSpiceLevelDisplay = (level: string) => {
    const spiceMap = {
      NONE: null,
      MILD: '🌶️ Mild',
      MEDIUM: '🌶️🌶️ Medium',
      HOT: '🌶️🌶️🌶️ Hot',
      EXTRA_HOT: '🔥 Extra Hot',
    };
    return spiceMap[level as keyof typeof spiceMap] || null;
  };

  if (loading) {
    return <MenuPageSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => {
              void fetchMenuData();
            }}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen mb-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-4 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 sm:mb-4">
            Our Menu
          </h2>
          {selectedSlug ? (
            <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Restaurant context: @{selectedSlug}</p>
          ) : (
            <p className="text-xs sm:text-sm text-orange-700 mb-1 sm:mb-2">No restaurant selected. Go to Home and select a restaurant first.</p>
          )}
          {searchParams.get('orderId') && (
            <p className="text-xs sm:text-sm text-green-700 mb-1 sm:mb-2">
              You are adding dishes to an ongoing meal.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6 sticky top-14 mt-2 bg-gray-50 py-2 z-40 shadow">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 text-sm sm:text-base"
            />
          </div>
        </div>

        <MenuItemsSection
          filteredItems={filteredItems}
          categories={categories}
          selectedCategory={selectedCategory}
          getCartItemQuantity={getCartItemQuantity}
          onAddToCart={handleAddToCart}
          onUpdateQuantity={handleUpdateQuantity}
          getSpiceLevelDisplay={getSpiceLevelDisplay}
        />
      </div>

      {/* Floating Categories Button - Glassy Finish */}
      <div className="fixed bottom-20 right-4 z-50 md:hidden">
        {/* Categories Panel - Expands upward */}
        {showCategoriesPanel && (
          <div className="absolute bottom-16 right-0 mb-2 w-48">
            <div className="backdrop-blur-xl bg-white/80 border border-white/40 shadow-2xl rounded-2xl overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setShowCategoriesPanel(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedCategory === 'all'
                    ? 'bg-orange-500/20 text-orange-700 font-medium'
                    : 'text-gray-700 hover:bg-white/50'
                    }`}
                >
                  All Items
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setShowCategoriesPanel(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedCategory === category.id
                      ? 'bg-orange-500/20 text-orange-700 font-medium'
                      : 'text-gray-700 hover:bg-white/50'
                      }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Hamburger Button - Glassy Circle */}
        <button
          onClick={() => setShowCategoriesPanel(!showCategoriesPanel)}
          className={`w-14 h-14 rounded-full backdrop-blur-xl shadow-2xl flex items-center justify-center transition-all duration-300 ${showCategoriesPanel
            ? 'bg-orange-500/90 border-2 border-white/50 text-white rotate-90'
            : 'bg-white/80 border-2 border-white/50 text-gray-700 hover:bg-white/90'
            }`}
          style={{
            boxShadow:
              '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 2px 4px rgba(255, 255, 255, 0.3)',
          }}
        >
          {showCategoriesPanel ? (
            <X className="h-6 w-6" />
          ) : (
            <MenuIcon className="h-6 w-6" />
          )}
        </button>
      </div>
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={<MenuPageSkeleton />}
    >
      <MenuPageContent />
    </Suspense>
  );
}