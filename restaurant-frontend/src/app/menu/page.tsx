'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { apiClient, MenuItem, Category } from '@/lib/api-client';
import { ChefHat, ShoppingCart, Plus, Minus, Filter, Search } from 'lucide-react';
import { useCartStore, CartItem } from '@/store/cart';
import { formatInr } from '@/lib/currency';
import toast from 'react-hot-toast';
import Image from 'next/image';

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
  const [selectedSubdomain, setSelectedSubdomain] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    isVeg: false,
    isVegan: false,
    isGlutenFree: false,
    spiceLevel: 'all',
  });

  useEffect(() => {
    setSelectedSubdomain(apiClient.getSelectedRestaurantSubdomain());
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
      
      // Enhanced toast notification with item details
      toast.success(
        <div className="flex items-center">
          <span className="font-medium">{item.name || 'Item'}</span>
          <span className="mx-2">added to cart!</span>
          <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 rounded">
            {formatInr(item.pricePaise)}
          </span>
        </div>,
        {
          duration: 3000,
          position: 'bottom-right',
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
        toast.success(`${item.name || 'Item'} removed from cart`);
      } else {
        updateQuantity(item.id, newQuantity);
        toast.success(`Quantity updated to ${newQuantity}`);
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
      NONE: 'No Spice',
      MILD: 'MILD',
      MEDIUM: 'MEDIUM',
      HOT: 'HOT',
      EXTRA_HOT: 'EXTRA HOT',
    };
    return spiceMap[level as keyof typeof spiceMap] || '';
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Our Menu</h2>
          {selectedSubdomain ? (
            <p className="text-sm text-gray-600 mb-2">Restaurant context: @{selectedSubdomain}</p>
          ) : (
            <p className="text-sm text-orange-700 mb-2">No restaurant selected. Go to Home and select a restaurant first.</p>
          )}
          {searchParams.get('orderId') && (
            <p className="text-sm text-green-700 mb-2">
              You are adding dishes to an ongoing meal.
            </p>
          )}
          
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <ChefHat className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No items found matching your criteria</p>
            </div>
          ) : (
            filteredItems.map(item => {
              const quantity = getCartItemQuantity(item.id);
              
              return (
                <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="relative">
                    {item.image && (
                      <Image
                        src={item.image}
                        alt={item.name || ''}
                        width={300}
                        height={200}
                        className="w-full h-48 object-cover"
                      />
                    )}
                    
                    {/* Dietary tags */}
                    <div className="absolute top-2 left-2 flex space-x-1">
                      {item.isVeg && <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">Veg</span>}
                      {item.isVegan && <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">Vegan</span>}
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold text-gray-800">{item.name || 'Unknown Item'}</h3>
                      <span className="text-lg font-bold text-orange-600">{formatInr(item.pricePaise)}</span>
                    </div>
                    
                    <p className="text-gray-600 mb-4 text-sm">{item.description || ''}</p>
                    
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs text-gray-500 uppercase tracking-wide bg-gray-100 px-2 py-1 rounded">
                        {getSpiceLevelDisplay(item.spiceLevel)}
                      </span>
                      
                      {/* Quantity controls instead of simple "Add to Cart" button */}
                      <div className="flex items-center">
                        {quantity === 0 ? (
                          <button
                            onClick={() => handleAddToCart(item)}
                            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                          >
                            Add to Cart
                          </button>
                        ) : (
                          <div className="flex items-center border border-gray-300 rounded-lg">
                            <button
                              onClick={() => handleUpdateQuantity(item, quantity - 1)}
                              className="p-2 text-gray-600 hover:bg-gray-100"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="px-3 py-1 font-medium">{quantity}</span>
                            <button
                              onClick={() => handleUpdateQuantity(item, quantity + 1)}
                              className="p-2 text-gray-600 hover:bg-gray-100"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
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
