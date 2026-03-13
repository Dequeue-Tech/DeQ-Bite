'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreditCard, MapPin, Clock, Check } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { apiClient, Table } from '@/lib/api-client';
import { formatInr } from '@/lib/currency';
import toast from 'react-hot-toast';
import SecurePaymentProcessor from '@/components/SecurePaymentProcessor';

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

  const [selectedTable, setSelectedTable] = useState('');
  const [selectedTableNumber, setSelectedTableNumber] = useState<string | null>(null);
  const [isTableLocked, setIsTableLocked] = useState(false);
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

  useEffect(() => {
    const storedTableNumber = apiClient.getSelectedTableNumber();
    if (storedTableNumber) {
      setSelectedTableNumber(storedTableNumber);
      setIsTableLocked(true);
    }
  }, []);

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
        setTables([]);
        setTablesError('Select a restaurant before choosing a table.');
        return;
      }
      setLoading(true);
      setTablesError(null);
      const response = await apiClient.getTables();
      if (response.success && Array.isArray(response.data)) {
        setTables(response.data.filter((table) => table.active));
      } else {
        setTables([]);
        setTablesError('Failed to load tables from the restaurant.');
      }
    } catch {
      setTables([]);
      setTablesError('Failed to load tables from the restaurant.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedTableNumber || selectedTable || tables.length === 0) return;
    const match = tables.find((table) => String(table.number) === String(selectedTableNumber));
    if (match) {
      setSelectedTable(match.id);
      return;
    }
    // If the stored table is not available, unlock selection so the user can choose.
    setIsTableLocked(false);
    apiClient.clearSelectedTableNumber();
    setSelectedTableNumber(null);
  }, [tables, selectedTableNumber, selectedTable]);

  const fetchPaymentProviders = async () => {
    try {
      const providers = await apiClient.getPaymentProviders();
      setPaymentProviders(providers);
      if (providers.includes('RAZORPAY')) setPaymentProvider('RAZORPAY');
    } catch {
      setPaymentProviders(['RAZORPAY', 'CASH']);
    }
  };

  const getSubtotalPaise = () => getTotalPricePaise();
  const getTaxPaise = (subtotalPaise: number, discountPaiseValue: number) => Math.round(Math.max(subtotalPaise - discountPaiseValue, 0) * 0.08);
  const getTotalPaise = (subtotalPaise: number, discountPaiseValue: number) => Math.max(subtotalPaise - discountPaiseValue, 0) + getTaxPaise(subtotalPaise, discountPaiseValue);

  const shouldPayBeforeMeal = restaurantPolicy?.paymentCollectionTiming === 'BEFORE_MEAL';

  const handlePlaceOrder = async () => {
    if (!requestedOrderId && (!selectedTable || !customerInfo.name || !customerInfo.email)) {
      toast.error('Please fill in all required fields and select a table');
      return;
    }

    if (cartItems.length === 0) {
      toast.error('Add items first');
      return;
    }

    setIsProcessing(true);

    try {
      if (requestedOrderId) {
        const response = await apiClient.addOrderItems(requestedOrderId, {
          items: cartItems.map((item) => ({ menuItemId: item.id, quantity: item.quantity, notes: '' })),
          specialInstructions: specialInstructions || '',
        });

        if (!response.success || !response.data) throw new Error(response.error || 'Failed to add dishes');

        setCreatedOrder(response.data);
        setOrderSummary({
          totalPaise: response.data.totalPaise,
          taxPaise: response.data.taxPaise,
          subtotalPaise: response.data.subtotalPaise,
          discountPaise: response.data.discountPaise || 0,
        });

        clearZustandCart();
        setActiveOrderId(null);

        if (response.data.paymentCollectionTiming === 'BEFORE_MEAL' && response.data.paymentProvider !== 'CASH') {
          setStep(2);
          toast.success('Dishes added. Complete payment to continue meal preparation.');
        } else {
          setStep(3);
          toast.success('Dishes added to ongoing meal.');
        }
        return;
      }

      const orderData = {
        tableId: selectedTable,
        items: cartItems.map((item) => ({ menuItemId: item.id, quantity: item.quantity, notes: '' })),
        specialInstructions: specialInstructions || '',
        couponCode: couponCode || undefined,
        paymentProvider,
      };

      const response = await apiClient.createOrder(orderData);
      if (!response.success || !response.data) throw new Error(response.error || 'Failed to place order');

      setCreatedOrder(response.data);

      if (response.data.paymentCollectionTiming === 'BEFORE_MEAL' && response.data.paymentProvider !== 'CASH') {
        setStep(2);
        toast.success('Order created. Proceed to payment.');
      } else {
        setOrderSummary({
          totalPaise: response.data.totalPaise,
          taxPaise: response.data.taxPaise,
          subtotalPaise: response.data.subtotalPaise,
          discountPaise: response.data.discountPaise || 0,
        });
        clearZustandCart();
        setStep(3);

        if (response.data.paymentProvider === 'CASH' && shouldPayBeforeMeal) {
          toast.success('Order created. Please pay cash to manager/admin for confirmation.');
        } else if (!shouldPayBeforeMeal) {
          toast.success('Order created. Payment can be completed at the end of meal.');
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to place order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentSuccess = () => {
    const subtotalPaise = getSubtotalPaise();
    setOrderSummary({
      totalPaise: createdOrder?.totalPaise || getTotalPaise(subtotalPaise, discountPaise),
      taxPaise: createdOrder?.taxPaise || getTaxPaise(subtotalPaise, discountPaise),
      subtotalPaise: createdOrder?.subtotalPaise || subtotalPaise,
      discountPaise: createdOrder?.discountPaise || discountPaise,
    });
    clearZustandCart();
    setStep(3);
  };

  const handlePaymentError = (errorMsg: string) => {
    toast.error(errorMsg || 'Payment failed');
  };

  const selectedTableInfo = tables.find((table) => table.id === selectedTable);

  if (!isAuthenticated) return null;

  if (step === 3) {
    const isPaid = createdOrder?.paymentStatus === 'COMPLETED' || paymentProvider !== 'CASH' && shouldPayBeforeMeal;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Updated</h2>
            <p className="text-gray-600 mb-6">
              {createdOrder?.paymentStatus === 'COMPLETED'
                ? 'Payment completed and order is confirmed.'
                : shouldPayBeforeMeal
                  ? 'Payment is required before meal preparation. Complete payment or ask admin to confirm cash.'
                  : 'Order confirmed. You can pay at the end of your meal.'}
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Order Total:</span>
                <span className="text-xl font-bold text-orange-600">
                  {formatInr(orderSummary ? orderSummary.totalPaise : createdOrder?.totalPaise || 0)}
                </span>
              </div>
              {selectedTableInfo && (
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>Table:</span>
                  <span>Table {selectedTableInfo.number} - {selectedTableInfo.location}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push(apiClient.buildRestaurantPath('/orders'))}
                className="w-full bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 transition-colors"
              >
                View My Orders
              </button>
              {isPaid && (
                <button
                  onClick={async () => {
                    if (!createdOrder?.id) return;
                    try {
                      const data: any = await apiClient.getInvoice(createdOrder.id);
                      const invoice = data?.invoice;
                      if (!invoice?.id) {
                        toast.error('Invoice not found');
                        return;
                      }
                      const result = await apiClient.downloadInvoicePdf(invoice.id);
                      const blobUrl = URL.createObjectURL(result.blob);
                      const a = document.createElement('a');
                      a.href = blobUrl;
                      a.download = result.filename || 'invoice.pdf';
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(blobUrl);
                    } catch (error: any) {
                      toast.error(error?.message || 'Failed to download invoice');
                    }
                  }}
                  className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Download Invoice (Paid Orders Only)
                </button>
              )}
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
              totalPaise: createdOrder.totalPaise,
              subtotalPaise: createdOrder.subtotalPaise,
              taxPaise: createdOrder.taxPaise,
              discountPaise: createdOrder.discountPaise || 0,
              table: createdOrder.table,
              items: createdOrder.items,
              paymentProvider,
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
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {restaurantPolicy && (
          <div className="mb-3 sm:mb-4 rounded-lg border border-orange-200 bg-orange-50 p-2.5 sm:p-3 text-xs sm:text-sm text-orange-800">
            {restaurantPolicy.paymentCollectionTiming === 'BEFORE_MEAL'
              ? 'This restaurant requires payment before meal preparation.'
              : 'This restaurant allows payment at the end of meal.'}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {!requestedOrderId && (
              <>
                <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">Customer Information</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <input
                      type="text"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm sm:text-base"
                      placeholder="Full name"
                    />
                    <input
                      type="email"
                      value={customerInfo.email}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm sm:text-base"
                      placeholder="Email"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Select Your Table
                  </h2>
                  {isTableLocked ? (
                    <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm">
                      <div>
                        <div className="font-semibold text-orange-800">
                          Table {selectedTableInfo?.number || selectedTableNumber}
                        </div>
                        <div className="text-orange-700 text-xs">
                          {selectedTableInfo?.location || 'Selected from QR'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsTableLocked(false);
                          apiClient.clearSelectedTableNumber();
                          setSelectedTableNumber(null);
                        }}
                        className="text-orange-700 text-xs font-semibold hover:text-orange-800"
                      >
                        Change table
                      </button>
                    </div>
                  ) : loading ? (
                    <div className="py-4 text-sm">Loading tables...</div>
                  ) : tablesError ? (
                    <div className="py-4 text-sm text-red-600">{tablesError}</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {tables.map((table) => (
                        <div
                          key={table.id}
                          className={`border-2 rounded-lg p-3 sm:p-4 cursor-pointer ${selectedTable === table.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}
                          onClick={() => {
                            setSelectedTable(table.id);
                            apiClient.setSelectedTableNumber(table.number);
                          }}
                        >
                          <h3 className="font-semibold text-base sm:text-lg">Table {table.number}</h3>
                          <p className="text-gray-600 text-xs sm:text-sm">{table.location || 'No location'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">Special Instructions</h2>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm sm:text-base"
                rows={3}
                placeholder="Any special requests..."
              />
            </div>

            {!requestedOrderId && (
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center">
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Payment Method
                </h2>
                <div className="space-y-2 sm:space-y-3">
                  {(paymentProviders.length ? paymentProviders : ['RAZORPAY', 'CASH'])
                    .filter((provider) => restaurantPolicy?.cashPaymentEnabled || provider !== 'CASH')
                    .map((provider) => (
                      <label key={provider} className="flex items-center text-sm sm:text-base">
                        <input
                          type="radio"
                          name="payment"
                          value={provider}
                          checked={paymentProvider === provider}
                          onChange={(e) => setPaymentProvider(e.target.value as any)}
                          className="mr-2 sm:mr-3"
                        />
                        <span>{provider}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 lg:sticky lg:top-8">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">Order Summary</h2>

              <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4 max-h-[200px] overflow-auto">
                {cartItems.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="font-medium truncate">{item.name}</p>
                      <p className="text-xs text-gray-600">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-semibold whitespace-nowrap">{formatInr(item.pricePaise * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-3 sm:pt-4 space-y-1.5 sm:space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">{formatInr(getSubtotalPaise())}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-semibold text-green-600">- {formatInr(discountPaise)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax (8%)</span>
                  <span className="font-semibold">{formatInr(getTaxPaise(getSubtotalPaise(), discountPaise))}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between">
                  <span className="text-base sm:text-lg font-semibold">Total</span>
                  <span className="text-base sm:text-lg font-bold text-orange-600">{formatInr(getTotalPaise(getSubtotalPaise(), discountPaise))}</span>
                </div>
              </div>

              {!requestedOrderId && (
                <div className="mt-3 sm:mt-4">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Coupon Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Enter coupon"
                    />
                    <button
                      onClick={async () => {
                        if (!couponCode.trim()) {
                          toast.error('Please enter a coupon code');
                          return;
                        }
                        try {
                          const data = await apiClient.validateCoupon(couponCode.trim(), getSubtotalPaise());
                          setDiscountPaise(data.discountPaise || 0);
                          toast.success('Coupon applied');
                        } catch (err: any) {
                          setDiscountPaise(0);
                          toast.error(err?.message || 'Invalid coupon');
                        }
                      }}
                      className="px-3 sm:px-4 py-2 bg-gray-900 text-white rounded-lg text-sm whitespace-nowrap"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 sm:mt-6">
                <button
                  onClick={handlePlaceOrder}
                  disabled={isProcessing || cartItems.length === 0 || (!requestedOrderId && !selectedTable) || !!tablesError}
                  className="w-full bg-orange-600 text-white py-2.5 sm:py-3 rounded-lg hover:bg-orange-700 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center text-sm sm:text-base"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 mr-2" />
                      {requestedOrderId ? 'Add to Order' : 'Place Order'}
                    </>
                  )}
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
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading checkout...</p>
          </div>
        </div>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}
