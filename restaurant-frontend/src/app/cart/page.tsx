'use client';

import { useRouter } from 'next/navigation';
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { apiClient } from '@/lib/api-client';
import { formatInr } from '@/lib/currency';

export default function CartPage() {
  const router = useRouter();
  const { items: cartItems, updateQuantity, removeItem, getTotalPricePaise, activeOrderId } = useCartStore();

  const proceedToCheckout = () => {
    const base = '/checkout';
    const target = activeOrderId ? `${base}?orderId=${activeOrderId}` : base;
    router.push(target);
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 text-center">
          <ShoppingCart className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3 sm:mb-4">Your cart is empty</h2>
          <p className="text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base">Start adding some delicious items to your cart!</p>
          <button
            onClick={() => router.push(apiClient.buildRestaurantPath('/menu'))}
            className="bg-orange-600 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg hover:bg-orange-700 transition-colors text-sm sm:text-base"
          >
            Browse Menu
          </button>
        </div>
      </div>
    );
  }

  // Calculate subtotal in paise (getTotalPricePaise from store includes all items)
  const subtotalPaise = getTotalPricePaise();
  const taxPaise = Math.round(subtotalPaise * 0.08);
  const totalPaise = subtotalPaise + taxPaise;

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
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 sm:mb-6">Order Summary</h2>
              
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">{formatInr(subtotalPaise)}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Tax (8%)</span>
                  <span className="font-semibold">{formatInr(taxPaise)}</span>
                </div>
                <div className="border-t border-gray-200 pt-3 sm:pt-4">
                  <div className="flex justify-between">
                    <span className="text-base sm:text-lg font-semibold">Total</span>
                    <span className="text-base sm:text-lg font-bold text-orange-600">
                      {formatInr(totalPaise)}
                    </span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={proceedToCheckout}
                className="w-full bg-orange-600 text-white py-2.5 sm:py-3 rounded-lg hover:bg-orange-700 transition-colors font-semibold text-sm sm:text-base"
              >
                Proceed to Checkout
              </button>
              
              <button
                onClick={() => router.push(apiClient.buildRestaurantPath('/menu'))}
                className="w-full mt-2 sm:mt-3 border border-gray-300 text-gray-700 py-2.5 sm:py-3 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
