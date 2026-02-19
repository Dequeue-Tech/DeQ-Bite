'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, MapPin, CreditCard, FileText, RefreshCw, Download, Mail, PlusCircle } from 'lucide-react';
import { apiClient, Order } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';
import { formatInr } from '@/lib/currency';

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  READY: 'bg-green-100 text-green-800',
  SERVED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function OrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [payNowOrderId, setPayNowOrderId] = useState<string | null>(null);
  const [couponByOrder, setCouponByOrder] = useState<Record<string, string>>({});
  const [applyingCouponOrderId, setApplyingCouponOrderId] = useState<string | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);
  const [sendingInvoice, setSendingInvoice] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchOrders();
      const timer = setInterval(fetchOrders, 15000);
      return () => clearInterval(timer);
    }
  }, [isAuthenticated, user]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getOrders();
      if (response.success) {
        setOrders(response.data || []);
      }
    } catch {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      setDownloadingInvoice(orderId);
      const order = orders.find((o) => o.id === orderId);
      if (!order || order.paymentStatus !== 'COMPLETED') {
        toast.error('Invoice is available only after payment is completed');
        return;
      }

      const invoiceResponse = await apiClient.getInvoice(orderId);
      let invoiceId = invoiceResponse?.invoice?.id as string | undefined;
      if (!invoiceId) {
        const gen = await apiClient.generateInvoice(orderId, []);
        invoiceId = gen?.invoice?.id;
      }
      if (!invoiceId) throw new Error('Failed to get invoice');

      const res = await apiClient.downloadInvoicePdf(invoiceId);
      const blobUrl = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = res.filename || 'invoice.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success('Invoice download started');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to download invoice');
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const handleSendInvoice = async (orderId: string) => {
    try {
      setSendingInvoice(orderId);
      const order = orders.find((o) => o.id === orderId);
      if (!order || order.paymentStatus !== 'COMPLETED') {
        toast.error('Invoice can be sent only after payment is completed');
        return;
      }

      try {
        const invoiceResponse = await apiClient.getInvoice(orderId);
        if (invoiceResponse?.invoice) {
          await apiClient.resendInvoice(invoiceResponse.invoice.id, ['EMAIL']);
        } else {
          await apiClient.generateInvoice(orderId, ['EMAIL']);
        }
      } catch {
        await apiClient.generateInvoice(orderId, ['EMAIL']);
      }
      toast.success('Invoice sent to your email');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send invoice');
    } finally {
      setSendingInvoice(null);
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();

  const handleApplyCouponToOrder = async (orderId: string) => {
    const couponCode = (couponByOrder[orderId] || '').trim();
    if (!couponCode) {
      toast.error('Enter a coupon code');
      return;
    }

    try {
      setApplyingCouponOrderId(orderId);
      const response = await apiClient.applyCouponToOrder(orderId, couponCode);
      if (response.success) {
        toast.success('Coupon applied');
        await fetchOrders();
      } else {
        throw new Error(response.error || 'Failed to apply coupon');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to apply coupon');
    } finally {
      setApplyingCouponOrderId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Your Orders</h1>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="flex items-center px-3 sm:px-4 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 text-sm sm:text-base"
          >
            <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48 sm:h-64">
            <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-orange-600" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3 sm:mb-4">No Orders Yet</h2>
            <button onClick={() => router.push('/menu')} className="bg-orange-600 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg hover:bg-orange-700 text-sm sm:text-base">
              Browse Menu
            </button>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {orders.map((order) => {
              const isOngoing = !['COMPLETED', 'CANCELLED'].includes(order.status);
              const canPayNow = order.paymentStatus !== 'COMPLETED' && order.paymentProvider !== 'CASH';

              return (
                <div key={order.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-800">Order #{order.id.substring(0, 8).toUpperCase()}</h3>
                        <p className="text-gray-600 text-xs sm:text-sm">{formatDate(order.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4">
                        <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                          {order.status}
                        </span>
                        <span className="text-lg sm:text-xl font-bold text-orange-600">{formatInr(order.totalPaise)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-4 text-xs sm:text-sm text-gray-600">
                      <div className="flex items-center"><MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />Table {order.table?.number || order.tableId}</div>
                      <div className="flex items-center"><Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />Est. {order.estimatedTime || 30} min</div>
                      <div className="flex items-center"><CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />{order.paymentProvider} | {order.paymentStatus}</div>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium text-gray-800">Items Ordered</h4>
                        <button onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)} className="text-orange-600 text-sm">
                          {selectedOrder === order.id ? 'Hide Details' : 'View Details'}
                        </button>
                      </div>

                      {selectedOrder === order.id && (
                        <div className="space-y-2 mb-4">
                          {order.items.map((item, index) => (
                            <div key={index} className="flex justify-between items-center py-2">
                              <div>
                                <span className="font-medium">{item.menuItem?.name || 'Item'}</span>
                                <span className="text-gray-600 ml-2">x{item.quantity}</span>
                              </div>
                              <span className="font-semibold">{formatInr(item.pricePaise * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3 sm:mt-4">
                      {isOngoing && (
                        <button
                          onClick={() => router.push(`/menu?orderId=${order.id}`)}
                          className="px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center text-xs sm:text-sm"
                        >
                          <PlusCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                          Add Dishes
                        </button>
                      )}

                      {canPayNow && (
                        <button
                          onClick={() => setPayNowOrderId(payNowOrderId === order.id ? null : order.id)}
                          className="px-3 sm:px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-xs sm:text-sm"
                        >
                          {payNowOrderId === order.id ? 'Hide' : 'Pay Now'}
                        </button>
                      )}

                      {order.paymentProvider === 'CASH' && order.paymentStatus !== 'COMPLETED' && (
                        <div className="px-3 sm:px-4 py-2 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200 text-xs">
                          Cash payment pending confirmation.
                        </div>
                      )}

                      {order.paymentStatus === 'COMPLETED' && (
                        <>
                          <button
                            onClick={() => handleDownloadInvoice(order.id)}
                            disabled={downloadingInvoice === order.id}
                            className="px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center text-xs sm:text-sm"
                          >
                            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                            {downloadingInvoice === order.id ? '...' : 'Download'}
                          </button>
                          <button
                            onClick={() => handleSendInvoice(order.id)}
                            disabled={sendingInvoice === order.id}
                            className="px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center text-xs sm:text-sm"
                          >
                            <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                            {sendingInvoice === order.id ? '...' : 'Send'}
                          </button>
                        </>
                      )}
                    </div>

                    {payNowOrderId === order.id && canPayNow && (
                      <div className="mt-3 sm:mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3 sm:p-4">
                        <h4 className="font-semibold text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Pay Now Details</h4>

                        <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-xs sm:text-sm">
                              <div className="text-gray-700 truncate flex-1 mr-2">
                                {item.menuItem?.name || 'Item'} x{item.quantity}
                              </div>
                              <div className="font-medium text-gray-900 whitespace-nowrap">
                                {formatInr(item.pricePaise * item.quantity)}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="border-t border-orange-200 pt-2 sm:pt-3 space-y-1 text-xs sm:text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Subtotal</span>
                            <span>{formatInr(order.subtotalPaise)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Discount</span>
                            <span className="text-green-700">- {formatInr(order.discountPaise || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Tax</span>
                            <span>{formatInr(order.taxPaise)}</span>
                          </div>
                          <div className="flex justify-between text-sm sm:text-base font-semibold pt-1">
                            <span>Total</span>
                            <span className="text-orange-700">{formatInr(order.totalPaise)}</span>
                          </div>
                        </div>

                        <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row gap-2">
                          <input
                            value={couponByOrder[order.id] || ''}
                            onChange={(e) => setCouponByOrder((prev) => ({ ...prev, [order.id]: e.target.value }))}
                            placeholder="Coupon code"
                            className="flex-1 px-3 py-2 border border-orange-200 rounded-lg text-sm"
                          />
                          <button
                            onClick={() => handleApplyCouponToOrder(order.id)}
                            disabled={applyingCouponOrderId === order.id}
                            className="px-3 sm:px-4 py-2 border border-orange-300 text-orange-800 rounded-lg hover:bg-orange-100 disabled:opacity-60 text-sm whitespace-nowrap"
                          >
                            {applyingCouponOrderId === order.id ? '...' : 'Apply'}
                          </button>
                          <button
                            onClick={() => router.push(`/checkout?orderId=${order.id}&payNow=1`)}
                            className="px-3 sm:px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm whitespace-nowrap"
                          >
                            Pay
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
