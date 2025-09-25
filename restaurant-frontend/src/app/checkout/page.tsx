'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChefHat, CreditCard, MapPin, Clock, ArrowLeft, Check } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { apiClient, Table } from '@/lib/api-client';
import toast from 'react-hot-toast';
import SecurePaymentProcessor from '@/components/SecurePaymentProcessor';

// Sample tables data as fallback
const sampleTables: Table[] = [
  { id: '1', number: 1, capacity: 4, location: 'Outdoor', active: true },
  { id: '2', number: 2, capacity: 6, location: 'Indoor', active: true },
  { id: '3', number: 3, capacity: 8, location: 'Outdoor', active: true },
]

export default function CheckoutPage() {
  const router = useRouter();
  const { items: cartItems, clearCart: clearZustandCart } = useCartStore();
  const { isAuthenticated, user } = useAuthStore();
  const [selectedTable, setSelectedTable] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [tables, setTables] = useState<Table[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState(1); // 1: Info & Table, 2: Payment, 3: Confirmation
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderSummary, setOrderSummary] = useState<{
    total: number;
    tax: number;
    subtotal: number;
  } | null>(null);

  useEffect(() => {
    // Redirect if not authenticated
    if (!isAuthenticated) {
      router.push('/auth/signin');
      return;
    }

    // Redirect if cart is empty, but only on initial load (step 1)
    // Don't redirect if we're already in step 2 (payment) or step 3 (confirmation)
    if (cartItems.length === 0 && step === 1) {
      router.push('/menu');
      return;
    }

    // Set customer info from user data
    if (user) {
      setCustomerInfo({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }

    // Fetch available tables
    fetchTables();
  }, [isAuthenticated, cartItems, user, router, step]);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getTables();
      if (response.success && Array.isArray(response.data)) {
        setTables(response.data.filter(table => table.active));
      } else {
        // Fallback to sample data if API fails
        console.warn('Failed to fetch tables from API, using sample data');
        setTables(sampleTables);
        toast('Using sample table data for demo purposes');
      }
    } catch (error: any) {
      console.error('Failed to fetch tables:', error);
      // Fallback to sample data if API fails
      setTables(sampleTables);
      toast('Using sample table data for demo purposes');
    } finally {
      setLoading(false);
    }
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTax = () => {
    return getTotalPrice() * 0.08; // 8% tax
  };

  const getFinalTotal = () => {
    return getTotalPrice() + getTax();
  };

  const handlePlaceOrder = async () => {
    if (!selectedTable || !customerInfo.name || !customerInfo.email) {
      toast.error('Please fill in all required fields and select a table');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Create order
      const orderData = {
        tableId: selectedTable,
        items: cartItems.map(item => ({
          menuItemId: item.id,
          quantity: item.quantity,
          notes: '' // Could add item-level notes in the future
        })),
        specialInstructions: specialInstructions || ''
      };

      console.log('Sending order data:', orderData);
      console.log('Cart items:', cartItems);

      const response = await apiClient.createOrder(orderData);
      if (response.success && response.data) {
        setCreatedOrder(response.data);
        setStep(2); // move to payment step
        toast.success('Order created. Proceed to payment.');
      } else {
        throw new Error(response.error || 'Failed to place order');
      }
    } catch (error: any) {
      console.error('Order placement failed:', error);
      toast.error(error.message || 'Failed to place order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentSuccess = () => {
    // Store order summary before clearing cart
    setOrderSummary({
      total: getFinalTotal(),
      tax: getTax(),
      subtotal: getTotalPrice()
    });
    
    // Clear cart and move to confirmation step
    clearZustandCart();
    setStep(3);
  };

  const handlePaymentError = (errorMsg: string) => {
    toast.error(errorMsg || 'Payment failed');
  };

  const selectedTableInfo = tables.find((table) => table.id === selectedTable);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">
            Please sign in to proceed with checkout.
          </p>
          <button
            onClick={() => router.push('/auth/signin')}
            className="bg-orange-600 text-white py-3 px-6 rounded-lg hover:bg-orange-700 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Confirmed!</h2>
            <p className="text-gray-600 mb-6">
              Your order has been placed successfully. You'll receive a confirmation email shortly.
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Order Total:</span>
                <span className="text-xl font-bold text-orange-600">
                  ₹{orderSummary ? orderSummary.total.toFixed(2) : '0.00'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>Table:</span>
                <span>Table {selectedTableInfo?.number} - {selectedTableInfo?.location}</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => router.push('/orders')}
                className="w-full bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 transition-colors"
              >
                View My Orders
              </button>
              <button
                onClick={() => router.push('/menu')}
                className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Order Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2 && createdOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Complete Payment</h2>
          <SecurePaymentProcessor
            order={{
              id: createdOrder.id,
              total: createdOrder.total,
              subtotal: createdOrder.subtotal,
              tax: createdOrder.tax,
              table: createdOrder.table,
              items: createdOrder.items,
            }}
            onPaymentSuccess={handlePaymentSuccess}
            onPaymentError={handlePaymentError}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Customer Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter your email"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>
            </div>

            {/* Table Selection */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                Select Your Table
              </h2>
              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tables.map((table) => (
                    <div
                      key={table.id}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedTable === table.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedTable(table.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-lg">Table {table.number}</h3>
                        <span className="text-sm text-gray-500">{table.capacity} seats</span>
                      </div>
                      <p className="text-gray-600 text-sm">{table.location || 'No location specified'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Special Instructions */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Special Instructions</h2>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                rows={3}
                placeholder="Any special requests or dietary requirements..."
              />
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                Payment Method
              </h2>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="payment"
                    value="razorpay"
                    checked={paymentMethod === 'razorpay'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mr-3 text-orange-600"
                  />
                  <div className="flex items-center">
                    <CreditCard className="h-5 w-5 mr-2 text-gray-600" />
                    <span>Razorpay (Cards, UPI, Wallets)</span>
                  </div>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="payment"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mr-3 text-orange-600"
                  />
                  <span>Cash on Delivery</span>
                </label>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Order Summary</h2>
              
              {/* Items */}
              <div className="space-y-3 mb-4">
                {cartItems.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-semibold">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">₹{getTotalPrice().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax (8%)</span>
                  <span className="font-semibold">₹{getTax().toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold">Total</span>
                    <span className="text-lg font-bold text-orange-600">
                      ₹{getFinalTotal().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              
              {selectedTableInfo && (
                <div className="mt-4 p-3 bg-orange-50 rounded-lg">
                  <p className="text-sm font-medium text-orange-800">
                    Selected Table: {selectedTableInfo.number}
                  </p>
                  <p className="text-sm text-orange-600">
                    {selectedTableInfo.location || 'No location specified'} • {selectedTableInfo.capacity} seats
                  </p>
                </div>
              )}
              
              <div className="mt-6">
                <button
                  onClick={handlePlaceOrder}
                  disabled={isProcessing || !selectedTable || !customerInfo.name || !customerInfo.email || cartItems.length === 0}
                  className="w-full bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 mr-2" />
                      Place Order
                    </>
                  )}
                </button>
              </div>
              
              <div className="mt-4 text-center">
                <p className="text-xs text-gray-500">
                  By placing this order, you agree to our terms and conditions
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}