'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { apiClient, MenuItem, Category } from '@/lib/api-client';
import {
  ChefHat,
  ShoppingCart,
  Plus,
  Minus,
  Filter,
  Search,
  Menu as MenuIcon,
  X,
} from 'lucide-react';
import { useCartStore, CartItem } from '@/store/cart';
import { formatInr } from '@/lib/currency';
import toast from 'react-hot-toast';
import Image from 'next/image';

function MenuPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const { items, addItem, removeItem, updateQuantity, setActiveOrderId, clearCart } = useCartStore();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState({
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
    fetchMenuData();
  }, [searchParams, setActiveOrderId]);

  const fetchMenuData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching menu data...');

      const [menuResponse, categoriesResponse] = await Promise.all([
        apiClient.getMenuItems(),
        apiClient.getCategories(),
      ]).catch(err => {
        console.error('Promise.all error:', err);
        throw err;
      });

      console.log('Menu response:', menuResponse);
      console.log('Categories response:', categoriesResponse);

      // Check if responses are valid and have success=true
      if (menuResponse && menuResponse.success && Array.isArray(menuResponse.data)) {
        console.log('Setting menu items:', menuResponse.data);
        setMenuItems(menuResponse.data);
      } else {
        console.error('Invalid menu response:', menuResponse);
        setMenuItems([]);
      }

      if (categoriesResponse && categoriesResponse.success && Array.isArray(categoriesResponse.data)) {
        console.log('Setting categories:', categoriesResponse.data);
        setCategories(categoriesResponse.data);
      } else {
        console.error('Invalid categories response:', categoriesResponse);
        setCategories([]);
      }
    } catch (err) {
      console.error('Error fetching menu data:', err);
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

    // Add error handling for cart operations
    try {
      addItem({
        id: item.id,
        name: item.name || '',
        pricePaise: item.pricePaise,
        image: item.image,
        quantity: 1,
      });

      const isFirstAddToast = !hasShownFirstAddToast.current;
      if (isFirstAddToast) {
        hasShownFirstAddToast.current = true;
      }

      // Enhanced toast notification with item details
      toast.success(
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{item.name || 'Item'}</span>
          <span className="text-gray-600 text-sm">added</span>
          <span className="bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
            {formatInr(item.pricePaise)}
          </span>
        </div>,
        {
          duration: 1500, // Slightly faster for a "snappier" feel
          position: 'top-center', // Perfectly centered at the top
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
        //toast.success(`${item.name || 'Item'} removed from cart`);
      } else {
        updateQuantity(item.id, newQuantity);
        //toast.success(`Quantity updated to ${newQuantity}`);
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
      MILD: null,
      MEDIUM: '🌶️',
      HOT: '🌶️🌶️',
      EXTRA_HOT: '🌶️🌶️🌶️',
    };
    return spiceMap[level as keyof typeof spiceMap] || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ChefHat className="h-12 w-12 text-orange-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchMenuData}
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

        <div className="space-y-6">
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <ChefHat className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-600 text-base sm:text-lg">
                No items found matching your criteria
              </p>
            </div>
          ) : (
            (() => {
              // Group items by category when showing all, respecting original category order
              const showAllCategories = selectedCategory === 'all';
              let itemsByCategory: Record<string, MenuItem[]> = {};

              if (showAllCategories) {
                // initialize keys in the order of categories array
                categories.forEach((cat) => {
                  itemsByCategory[cat.name] = [];
                });

                filteredItems.forEach((item) => {
                  const catName =
                    categories.find((c) => c.id === item.categoryId)?.name ||
                    'Other';
                  if (!itemsByCategory[catName]) {
                    itemsByCategory[catName] = [];
                  }
                  itemsByCategory[catName].push(item);
                });
              } else {
                itemsByCategory = { All: filteredItems };
              }

              // rotate each category list by 1 when showing all
              if (showAllCategories) {
                Object.keys(itemsByCategory).forEach((cat) => {
                  const arr = itemsByCategory[cat];
                  if (arr.length > 1) {
                    itemsByCategory[cat] = [...arr.slice(1), arr[0]];
                  }
                });
              }

              return Object.entries(itemsByCategory).map(
                ([categoryName, items]) => (
                  <div key={categoryName}>
                    {/* Category separator - only show when viewing all categories */}
                    {showAllCategories && (
                      <div className="flex items-center gap-4 mb-4">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800 whitespace-nowrap">
                          {categoryName}
                        </h2>
                        <div className="flex-1 h-px bg-gray-300"></div>
                        <span className="text-sm text-gray-500">
                          {items.length} items
                        </span>
                      </div>
                    )}

                    {/* Items grid for this category */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {items.map((item) => {
                        const quantity = getCartItemQuantity(item.id);

                        return (
                          <div
                            key={item.id}
                            className="bg-white rounded-lg shadow-md overflow-hidden menu-item-card"
                          >
                            <div className="p-3 sm:p-4">
                              <div className="flex gap-3 sm:gap-4">
                                {/* Left side - Text content */}
                                <div className="flex-1 min-w-0">
                                  {/* Dietary tags */}
                                  <div className="flex items-center gap-2 mb-2 text-xs">
                                    <span
                                      className={`h-2 w-2 rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`}
                                    ></span>
                                    <span>{item.preparationTime} min</span>
                                  </div>

                                  <h3 className="text-sm sm:text-base font-semibold text-gray-800 line-clamp-1 mb-1">
                                    {item.name || 'Unknown Item'}
                                  </h3>
                                  <p className="text-gray-600 text-xs sm:text-sm line-clamp-2 mb-2">
                                    {item.description || ''}
                                  </p>

                                  <div className="flex items-center gap-3 mb-3">
                                    {/* Price - Slightly larger and bolder */}
                                    <span className="text-base sm:text-lg font-extrabold text-orange-600 tracking-tight">
                                      {formatInr(item.pricePaise)}
                                    </span>

                                    {/* Vertical Divider */}
                                    <div className="w-[1px] h-4 bg-gray-200" />

                                    {/* Spice Level Badge */}
                                    {getSpiceLevelDisplay(item.spiceLevel) && (
                                      <div className="flex items-center bg-orange-50 border border-orange-100 px-2 py-1 rounded-md">
                                        <span className="text-[10px] sm:text-xs tracking-widest">
                                          {getSpiceLevelDisplay(item.spiceLevel)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Right side - Image and Add button */}
                                <div className="flex flex-col items-center gap-2">
                                  {/* Item image (fallback to placeholder if missing) */}
                                  <Image
                                    src={encodeURI(
                                      item.image ||
                                      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600',
                                    )}
                                    alt={item.name || ''}
                                    width={80}
                                    height={80}
                                    loading="lazy"
                                    unoptimized
                                    className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg"
                                  />

                                  {/* Add button / Quantity controls */}
                                  {quantity === 0 ? (
                                    <button
                                      onClick={() => handleAddToCart(item)}
                                      className="w-16 sm:w-20 bg-orange-600 text-white px-2 py-1.5 rounded-lg hover:bg-orange-700 transition-colors text-xs sm:text-sm font-medium"
                                    >
                                      Add
                                    </button>
                                  ) : (
                                    <div className="flex items-center border border-gray-300 rounded-lg w-16 sm:w-20 justify-center">
                                      <button
                                        onClick={() =>
                                          handleUpdateQuantity(
                                            item,
                                            quantity - 1,
                                          )
                                        }
                                        className="p-1 sm:p-1.5 text-gray-600 hover:bg-gray-100"
                                      >
                                        <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                                      </button>
                                      <span className="px-1 sm:px-2 py-0.5 text-xs sm:text-sm font-medium min-w-[1rem] text-center">
                                        {quantity}
                                      </span>
                                      <button
                                        onClick={() =>
                                          handleUpdateQuantity(
                                            item,
                                            quantity + 1,
                                          )
                                        }
                                        className="p-1 sm:p-1.5 text-gray-600 hover:bg-gray-100"
                                      >
                                        <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ),
              );
            })()
          )}
        </div>
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
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <ChefHat className="h-12 w-12 text-orange-600 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600">Loading menu...</p>
          </div>
        </div>
      }
    >
      <MenuPageContent />
    </Suspense>
  );
}
