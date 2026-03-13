'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  CreditCard, 
  MapPin, 
  Clock, 
  Check, 
  Ticket, 
  ChevronRight, 
  User, 
  Info,
  ArrowLeft,
  Receipt
} from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { apiClient, Table } from '@/lib/api-client';
import { formatInr } from '@/lib/currency';
import toast from 'react-hot-toast';
import SecurePaymentProcessor from '@/components/SecurePaymentProcessor';
import confetti from 'canvas-confetti';

function CheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    items: cartItems,
    clearCart: clearZustandCart,
    getTotalPricePaise,
    activeOrderId,
    setActiveOrderId,
  } = useCartStore();
  const { isAuthenticated, user } = useAuthStore();

  const requestedOrderId = searchParams.get('orderId') || activeOrderId;
  const payNow = searchParams.get('payNow') === '1';

  // UI State
  const [selectedTable, setSelectedTable] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', phone: '' });
  const [tables, setTables] = useState<Table[]>([]);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<'RAZORPAY' | 'PAYTM' | 'PHONEPE' | 'CASH'>('RAZORPAY');
  const [paymentProviders, setPaymentProviders] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState(1);
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderSummary, setOrderSummary] = useState<{ totalPaise: number; taxPaise: number; subtotalPaise: number; discountPaise: number } | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [discountPaise, setDiscountPaise] = useState(0);
  const [restaurantPolicy, setRestaurantPolicy] = useState<{ paymentCollectionTiming: 'BEFORE_MEAL' | 'AFTER_MEAL'; cashPaymentEnabled: boolean } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/signin');
      return;
    }

    if (cartItems.length === 0 && !requestedOrderId && step === 1) {
      router.push(apiClient.buildRestaurantPath('/menu'));
      return;
    }

    if (user) {
      setCustomerInfo({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }

    fetchTables();
    fetchPaymentProviders();
    fetchRestaurantPolicy();

    if (payNow && requestedOrderId) {
      preloadExistingOrderForPayment(requestedOrderId);
    }
  }, [isAuthenticated, cartItems.length, user, router, step, requestedOrderId, payNow]);

  const preloadExistingOrderForPayment = async (orderId: string) => {
    try {
      const response = await apiClient.getOrder(orderId);
      if (response.success && response.data) {
        setCreatedOrder(response.data);
        if (response.data.paymentProvider && response.data.paymentProvider !== 'CASH') {
          setPaymentProvider(response.data.paymentProvider);
          setStep(2);
        }
      }
    } catch {
      toast.error('Failed to load order for payment');
    }
  };

  const fetchRestaurantPolicy = async () => {
    try {
      const data = await apiClient.getCurrentRestaurant();
      if (data) {
        setRestaurantPolicy({
          paymentCollectionTiming: data.paymentCollectionTiming,
          cashPaymentEnabled: data.cashPaymentEnabled,
        });
      }
    } catch {
      setRestaurantPolicy({ paymentCollectionTiming: 'AFTER_MEAL', cashPaymentEnabled: true });
    }
  };

  const fetchTables = async () => {
    try {
      const activeSlug = apiClient.getActiveRestaurantSlug();
      if (!activeSlug) {
        setTablesError('Select a restaurant before choosing a table.');
        return;
      }
      setLoading(true);
      const response = await apiClient.getTables();
      if (response.success && Array.isArray(response.data)) {
        setTables(response.data.filter((table) => table.active));
      }
    } catch {
      setTablesError('Failed to load tables.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentProviders = async () => {
    try {
      const providers = await apiClient.getPaymentProviders();
      setPaymentProviders(providers);
      if (providers.includes('RAZORPAY')) setPaymentProvider('RAZORPAY');
    } catch {
      setPaymentProviders(['RAZORPAY', 'CASH']);
    }
  };

  const handleCouponApply = async () => {
    if (!couponCode.trim()) {
      toast.error('Enter a code first');
      return;
    }
    try {
      const data = await apiClient.validateCoupon(couponCode.trim(), getSubtotalPaise());
      setDiscountPaise(data.discountPaise || 0);
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ea580c', '#fbbf24', '#ffffff']
      });

      toast.success('Coupon applied successfully!');
    } catch (err: any) {
      setDiscountPaise(0);
      toast.error(err?.message || 'Invalid coupon');
    }
  };

  const getSubtotalPaise = () => getTotalPricePaise();
  const getTaxPaise = (subtotalPaise: number, discountValue: number) => Math.round(Math.max(subtotalPaise - discountValue, 0) * 0.08);
  const getTotalPaise = (subtotalPaise: number, discountValue: number) => Math.max(subtotalPaise - discountValue, 0) + getTaxPaise(subtotalPaise, discountValue);

  const handlePlaceOrder = async () => {
    if (!requestedOrderId && (!selectedTable || !customerInfo.name)) {
      toast.error('Please select a table and verify your name');
      return;
    }
    setIsProcessing(true);
    try {
      if (requestedOrderId) {
        const response = await apiClient.addOrderItems(requestedOrderId, {
          items: cartItems.map((item) => ({ menuItemId: item.id, quantity: item.quantity, notes: '' })),
          specialInstructions: specialInstructions || '',
        });
        if (!response.success || !response.data) throw new Error(response.error);
        setCreatedOrder(response.data);
        setOrderSummary({
          totalPaise: response.data.totalPaise,
          taxPaise: response.data.taxPaise,
          subtotalPaise: response.data.subtotalPaise,
          discountPaise: response.data.discountPaise || 0,
        });
        clearZustandCart();
        setActiveOrderId(null);
        setStep(response.data.paymentCollectionTiming === 'BEFORE_MEAL' && response.data.paymentProvider !== 'CASH' ? 2 : 3);
      } else {
        const orderData = {
          tableId: selectedTable,
          items: cartItems.map((item) => ({ menuItemId: item.id, quantity: item.quantity, notes: '' })),
          specialInstructions: specialInstructions || '',
          couponCode: couponCode || undefined,
          paymentProvider,
        };
        const response = await apiClient.createOrder(orderData);
        if (!response.success || !response.data) throw new Error(response.error);
        setCreatedOrder(response.data);
        if (response.data.paymentCollectionTiming === 'BEFORE_MEAL' && response.data.paymentProvider !== 'CASH') {
          setStep(2);
        } else {
          setOrderSummary({
            totalPaise: response.data.totalPaise,
            taxPaise: response.data.taxPaise,
            subtotalPaise: response.data.subtotalPaise,
            discountPaise: response.data.discountPaise || 0,
          });
          clearZustandCart();
          setStep(3);
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Order placement failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // UI VIEWS
  if (step === 3) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">Order Confirmed</h2>
          <p className="text-gray-500 mb-8">Your request has been sent to the kitchen. Relax and enjoy your meal!</p>
          <div className="bg-gray-50 rounded-3xl p-6 mb-8 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-500 font-medium">Amount Due:</span>
              <span className="text-2xl font-black text-orange-600">
                {formatInr(orderSummary?.totalPaise || createdOrder?.totalPaise || 0)}
              </span>
            </div>
            <div className="h-px bg-gray-200 w-full mb-4" />
            <p className="text-xs text-gray-400 italic">
              Order ID: #{createdOrder?.id?.slice(-8).toUpperCase()}
            </p>
          </div>
          <button
            onClick={() => router.push(apiClient.buildRestaurantPath('/orders'))}
            className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all"
          >
            Track My Order
          </button>
        </div>
      </div>
    );
  }

  if (step === 2 && createdOrder) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl border border-gray-100 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-orange-600" />
            </div>
            <h2 className="text-xl font-black text-gray-900">Secure Payment</h2>
          </div>
          <SecurePaymentProcessor
            order={{ ...createdOrder, paymentProvider }}
            onPaymentSuccess={() => {
              setOrderSummary(createdOrder);
              clearZustandCart();
              setStep(3);
            }}
            onPaymentError={(msg) => toast.error(msg)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] pb-32">
      <div className="max-w-6xl mx-auto px-4 pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-black tracking-tight">Checkout</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {restaurantPolicy && (
          <div className="mb-8 flex items-center gap-3 bg-orange-50 border border-orange-100 p-4 rounded-2xl text-orange-800 text-sm font-medium">
            <Info className="h-5 w-5 flex-shrink-0" />
            {restaurantPolicy.paymentCollectionTiming === 'BEFORE_MEAL'
              ? 'Restaurant requires payment before preparation.'
              : 'You can pay at the end of your meal.'}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-7 space-y-10">
            
            {/* Table Selection */}
            {!requestedOrderId && (
              <section>
                <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-orange-600" />
                  Your Table
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {tables.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => setSelectedTable(table.id)}
                      className={`relative p-5 rounded-3xl text-left transition-all border-2 ${
                        selectedTable === table.id 
                        ? 'border-orange-600 bg-orange-50/50 ring-4 ring-orange-100' 
                        : 'border-gray-100 bg-white'
                      }`}
                    >
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${selectedTable === table.id ? 'text-orange-600' : 'text-gray-400'}`}>
                        {table.location}
                      </p>
                      <p className="text-2xl font-black text-gray-900">T-{table.number}</p>
                      {selectedTable === table.id && <Check className="absolute top-4 right-4 h-5 w-5 text-orange-600" />}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Customer & Notes */}
            <section className="space-y-4">
              <h2 className="text-lg font-black flex items-center gap-2">
                <User className="h-5 w-5 text-orange-600" />
                Details
              </h2>
              <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
                {!requestedOrderId && (
                   <input
                   type="text"
                   value={customerInfo.name}
                   onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                   className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-orange-500/20"
                   placeholder="Your Name"
                 />
                )}
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-orange-500/20"
                  rows={3}
                  placeholder="Any cooking instructions? (e.g., Less spicy, no onion)"
                />
              </div>
            </section>

            {/* Payment Options */}
            {!requestedOrderId && (
              <section>
                <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-orange-600" />
                  Payment
                </h2>
                <div className="space-y-3">
                  {paymentProviders.map((provider) => (
                    <button
                      key={provider}
                      onClick={() => setPaymentProvider(provider as any)}
                      className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${
                        paymentProvider === provider ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-100 bg-white text-gray-700'
                      }`}
                    >
                      <span className="font-bold">{provider}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentProvider === provider ? 'border-white' : 'border-gray-300'}`}>
                        {paymentProvider === provider && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar Summary */}
          <div className="lg:col-span-5">
            <div className="sticky top-10 bg-white rounded-[40px] border border-gray-100 shadow-2xl overflow-hidden">
              <div className="p-8 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Receipt className="h-5 w-5 text-gray-400" />
                  <h2 className="font-black text-gray-900">Summary</h2>
                </div>

                <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="bg-gray-100 px-2 py-1 rounded-lg text-xs font-black text-gray-500">{item.quantity}x</div>
                        <p className="text-sm font-bold text-gray-800">{item.name}</p>
                      </div>
                      <span className="text-sm font-bold">{formatInr(item.pricePaise * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-dashed border-gray-200 space-y-3">
                  {/* Coupon */}
                  <div className="relative">
                    <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="PROMO CODE"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      className="w-full pl-11 pr-24 py-4 bg-gray-50 rounded-2xl border-none text-xs font-bold tracking-widest focus:ring-2 focus:ring-orange-500/20"
                    />
                    <button 
                      onClick={handleCouponApply}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[10px] font-black px-4 py-2 rounded-xl"
                    >
                      APPLY
                    </button>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-sm text-gray-400 font-medium">
                      <span>Subtotal</span>
                      <span>{formatInr(getSubtotalPaise())}</span>
                    </div>
                    {discountPaise > 0 && (
                      <div className="flex justify-between text-sm text-green-600 font-bold">
                        <span>Discount</span>
                        <span>-{formatInr(discountPaise)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-gray-400 font-medium">
                      <span>Tax (GST 8%)</span>
                      <span>{formatInr(getTaxPaise(getSubtotalPaise(), discountPaise))}</span>
                    </div>
                    <div className="flex justify-between pt-4 text-2xl font-black text-gray-900">
                      <span>Total</span>
                      <span>{formatInr(getTotalPaise(getSubtotalPaise(), discountPaise))}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={isProcessing || cartItems.length === 0}
                  className="w-full group relative bg-orange-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-orange-200 hover:bg-orange-700 hover:-translate-y-1 active:translate-y-0 transition-all disabled:bg-gray-200 disabled:shadow-none"
                >
                  <span className="flex items-center justify-center gap-2">
                    {isProcessing ? 'Processing...' : (requestedOrderId ? 'Confirm Items' : 'Place Order')}
                    <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <CheckoutPageContent />
    </Suspense>
  );
}