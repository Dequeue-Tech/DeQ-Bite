'use client';

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatInr } from "@/lib/currency";
import toast from "react-hot-toast";

export default function CartPage() {
  const router = useRouter();
  const params = useParams();
  
  // Get slug from multiple sources: route param > localStorage > store
  const routeSlug = typeof params?.restaurantSlug === "string" ? params.restaurantSlug : null;
  const storedSlug = typeof window !== 'undefined' ? localStorage.getItem('selectedRestaurantSlug') : null;
  const { activeRestaurantSlug } = useCartStore();
  
  const restaurantSlug = routeSlug || storedSlug || activeRestaurantSlug;

  const {
    items: cartItems,
    updateQuantity,
    removeItem,
    getTotalPricePaise,
    activeOrderId,
    setActiveRestaurantSlug,
    clearCart,
  } = useCartStore();

  useEffect(() => {
    if (!restaurantSlug) return;
    if (activeRestaurantSlug && activeRestaurantSlug !== restaurantSlug) {
      clearCart();
    }
    setActiveRestaurantSlug(restaurantSlug);
  }, [restaurantSlug, activeRestaurantSlug, setActiveRestaurantSlug, clearCart]);

  const proceedToCheckout = () => {
    console.log('Proceeding to checkout...');
    console.log('Restaurant slug:', restaurantSlug);
    console.log('Active order ID:', activeOrderId);
    
    if (!restaurantSlug) {
      console.error('No restaurant slug found');
      toast.error('Please select a restaurant first');
      return;
    }
    
    const checkoutPath = activeOrderId
      ? `/${restaurantSlug}/checkout?orderId=${activeOrderId}`
      : `/${restaurantSlug}/checkout`;
    
    console.log('Navigating to:', checkoutPath);
    router.push(checkoutPath);
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 mb-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 text-center">
          <ShoppingCart className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3 sm:mb-4">Your cart is empty</h2>
          <p className="text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base">Start adding some delicious items to your cart!</p>
          <button
            onClick={() =>
              router.push(restaurantSlug ? `/${restaurantSlug}/menu` : "/")
            }
            className="bg-orange-600 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg hover:bg-orange-700 transition-colors text-sm sm:text-base"
          >
            Browse Menu
          </button>
        </div>
      </div>
    );
  }

  // Indian Restaurant GST Logic (Standard 5%)
  const subtotalPaise = getTotalPricePaise();

  // 5% Total GST split into 2.5% each
  const cgstPaise = Math.round(subtotalPaise * 0.025);
  const sgstPaise = Math.round(subtotalPaise * 0.025);
  const totalGstPaise = cgstPaise + sgstPaise;

  const totalPaise = subtotalPaise + totalGstPaise;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-4 sm:p-6 border-b border-gray-200">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Your Items</h2>
              </div>
              
              <div className="divide-y divide-gray-200">
                {cartItems.map(item => (
                  <div key={item.id} className="p-3 sm:p-6">
                    <div className="flex items-center gap-3 sm:gap-4">
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm sm:text-lg font-semibold text-gray-800 truncate">{item.name}</h3>
                        <p className="text-gray-600 text-xs sm:text-sm">{formatInr(item.pricePaise)} each</p>
                      </div>
                      
                      <div className="flex items-center gap-2 sm:gap-3">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="bg-gray-200 text-gray-700 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center hover:bg-gray-300"
                        >
                          <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>
                        <span className="font-semibold text-base sm:text-lg min-w-[1.5rem] text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="bg-orange-600 text-white w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center hover:bg-orange-700"
                        >
                          <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>
                      </div>
                      
                      <div className="text-right hidden sm:block">
                        <p className="text-lg font-semibold text-gray-800">
                          {formatInr(item.pricePaise * item.quantity)}
                        </p>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-red-600 hover:text-red-700 mt-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-red-600 hover:text-red-700 sm:hidden flex-shrink-0 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 sm:hidden text-right">
                      <p className="text-sm font-semibold text-gray-800">
                        {formatInr(item.pricePaise * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 lg:sticky lg:top-8">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 sm:mb-6">
                Bill Details
              </h2>

              <div className="space-y-3 mb-4 sm:mb-6">
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Item Total</span>
                  <span className="font-medium text-gray-800">
                    {formatInr(subtotalPaise)}
                  </span>
                </div>

                {/* Indian GST Breakdown */}
                <div className="space-y-1 pt-2 border-t border-dashed border-gray-200">
                  <div className="flex justify-between text-xs sm:text-sm text-gray-500">
                    <span>CGST (2.5%)</span>
                    <span>{formatInr(cgstPaise)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm text-gray-500">
                    <span>SGST (2.5%)</span>
                    <span>{formatInr(sgstPaise)}</span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3 sm:pt-4 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-base sm:text-lg font-bold text-gray-900">
                      To Pay
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-orange-600">
                      {formatInr(totalPaise)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={proceedToCheckout}
                className="w-full bg-orange-600 text-white py-3 sm:py-4 rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 font-bold text-sm sm:text-base mb-3"
              >
                Proceed to Checkout
              </button>

              <button
                onClick={() =>
                  router.push(restaurantSlug ? `/${restaurantSlug}/menu` : "/")
                }
                className="w-full border border-gray-300 text-gray-600 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Add more items
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-md mb-8">
        {/* Subtle Background Glow */}
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-orange-500/10 blur-3xl" />

        <div className="relative flex flex-col items-center text-center">
          {/* Main Brand with a Gradient */}
          <h1 className="text-2xl font-black tracking-tighter text-gray-900 sm:text-3xl">
            <span className="text-orange-600">#</span>Bite
          </h1>

          {/* Product Line with Spacing */}
          <div className="my-2 flex items-center gap-2">
            <div className="h-[1px] w-4 bg-gray-300" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 sm:text-xs">
              Product of Dequeue
            </h2>
            <div className="h-[1px] w-4 bg-gray-300" />
          </div>

          {/* Legal Text - Clean and tiny */}
          <h3 className="max-w-[250px] text-[8px] leading-relaxed text-gray-400 sm:text-[10px]">
            Terms and conditions applied <br />
            <span className="font-semibold uppercase">
              Dequeue Retail Technologies Pvt Ltd.
            </span>
          </h3>
        </div>
      </div>
    </div>
  );
}
