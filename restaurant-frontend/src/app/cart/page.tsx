'use client';

import { useRouter } from 'next/navigation';
import { ChefHat, ShoppingCart, Plus, Minus, Trash2, ArrowLeft } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { formatInr } from '@/lib/currency';

export default function CartPage() {
  const router = useRouter();
  const { items: cartItems, updateQuantity, removeItem, getTotalPricePaise } = useCartStore();

  const proceedToCheckout = () => {
    router.push('/checkout');
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/menu')}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <ChefHat className="h-8 w-8 text-orange-600 mr-2" />
              <h1 className="text-2xl font-bold text-gray-800">Shopping Cart</h1>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Your cart is empty</h2>
          <p className="text-gray-600 mb-8">Start adding some delicious items to your cart!</p>
          <button
            onClick={() => router.push('/menu')}
            className="bg-orange-600 text-white px-8 py-3 rounded-lg hover:bg-orange-700 transition-colors"
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
      

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">Your Items</h2>
              </div>
              
              <div className="divide-y divide-gray-200">
                {cartItems.map(item => (
                  <div key={item.id} className="p-6">
                    <div className="flex items-center space-x-4">
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      )}
                      
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
                        <p className="text-gray-600">{formatInr(item.pricePaise)} each</p>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="bg-gray-200 text-gray-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-300"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="font-semibold text-lg">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-orange-700"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <div className="text-right">
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Order Summary</h2>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">{formatInr(subtotalPaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax (8%)</span>
                  <span className="font-semibold">{formatInr(taxPaise)}</span>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold">Total</span>
                    <span className="text-lg font-bold text-orange-600">
                      {formatInr(totalPaise)}
                    </span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={proceedToCheckout}
                className="w-full bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 transition-colors font-semibold"
              >
                Proceed to Checkout
              </button>
              
              <button
                onClick={() => router.push('/menu')}
                className="w-full mt-3 border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors"
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
