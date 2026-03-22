'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Clock, MapPin, CreditCard, FileText, 
  RefreshCw, Download, Mail, PlusCircle,
  ArrowLeft, Receipt, CheckCircle, ChefHat, 
  ShoppingBag, ChevronRight, Ticket, Info,
  BellRing, X
} from 'lucide-react';
import { apiClient, Order } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';
import { formatInr } from '@/lib/currency';
import { subscribeToOrderEvents } from '@/lib/realtime-client';

// Helper to format dates nicely
const formatOrderDate = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  
  if (isToday) {
    return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

// Premium Status Badge styling
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'PENDING':
    case 'CONFIRMED':
      return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, label: 'In Queue' };
    case 'PREPARING':
      return { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: ChefHat, label: 'Preparing' };
    case 'READY':
      return { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: ShoppingBag, label: 'Ready' };
    case 'SERVED':
    case 'COMPLETED':
      return { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, label: 'Completed' };
    case 'CANCELLED':
      return { color: 'bg-red-100 text-red-800 border-red-200', icon: X, label: 'Cancelled' };
    default:
      return { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Receipt, label: status };
  }
};

export default function OrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLimit] = useState(5);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [payNowOrderId, setPayNowOrderId] = useState<string | null>(null);
  const [couponByOrder, setCouponByOrder] = useState<Record<string, string>>({});
  const [applyingCouponOrderId, setApplyingCouponOrderId] = useState<string | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);
  const [sendingInvoice, setSendingInvoice] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; time: string }>>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'PAST'>('ACTIVE');

  useEffect(() => {
    if (isAuthenticated && user) {
      setOrdersPage(1);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchOrders(ordersPage);
    }
  }, [isAuthenticated, user, ordersPage]);

  useEffect(() => {
    if (!isAuthenticated || !user || typeof window === 'undefined') return;
    const cleanup = subscribeToOrderEvents({
      scope: 'user',
      onEvent: (event) => {
        const order = event?.payload?.order;
        if (!order?.id) return;
        handleRealtimeOrderUpdate(order);
      },
    });

    return cleanup;
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
    } else {
      setNotificationPermission(Notification.permission);
    }
    try {
      const stored = localStorage.getItem('order_notifications');
      if (stored) {
        setNotifications(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const enqueueNotifications = (newNotifs: Array<{ id: string; message: string; time: string }>) => {
    if (!newNotifs.length) return;

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      newNotifs.slice(0, 3).forEach((note) => {
        try {
          new Notification('Order Update', {
            body: note.message,
            tag: note.id,
          });
        } catch {
          // ignore notification errors
        }
      });
    }

    setNotifications((prev) => {
      const merged = [...newNotifs, ...prev].slice(0, 20);
      if (typeof window !== 'undefined') {
        localStorage.setItem('order_notifications', JSON.stringify(merged));
      }
      return merged;
    });
  };

  const updateSnapshot = (orderId: string, status: string, paymentStatus: string) => {
    if (typeof window === 'undefined') return;
    try {
      const snapshotRaw = localStorage.getItem('order_status_snapshot');
      const snapshot: Record<string, { status: string; paymentStatus: string }> = snapshotRaw ? JSON.parse(snapshotRaw) : {};
      snapshot[orderId] = { status, paymentStatus };
      localStorage.setItem('order_status_snapshot', JSON.stringify(snapshot));
    } catch {
      // ignore
    }
  };

  const applyOrderUpdate = (incoming: Partial<Order> & { id: string }) => {
    setOrders((prev) => {
      const index = prev.findIndex((order) => order.id === incoming.id);
      const existing = index >= 0 ? prev[index] : null;
      const nextOrder: Order = existing
        ? {
            ...existing,
            ...incoming,
            items: incoming.items ?? existing.items,
            table: incoming.table ?? existing.table,
            user: incoming.user ?? existing.user,
          }
        : (incoming as Order);

      if (index === -1) {
        if (ordersPage !== 1) return prev;
        return [nextOrder, ...prev].slice(0, ordersLimit);
      }

      const next = [...prev];
      next[index] = nextOrder;
      return next;
    });
  };

  const handleRealtimeOrderUpdate = (incoming: Partial<Order> & { id: string }) => {
    let added = false;
    setOrders((prev) => {
      const index = prev.findIndex((order) => order.id === incoming.id);
      const existing = index >= 0 ? prev[index] : null;
      const nextOrder: Order = existing
        ? {
            ...existing,
            ...incoming,
            items: incoming.items ?? existing.items,
            table: incoming.table ?? existing.table,
            user: incoming.user ?? existing.user,
          }
        : (incoming as Order);

      if (existing) {
        const newNotifs: Array<{ id: string; message: string; time: string }> = [];
        if (incoming.status && incoming.status !== existing.status) {
          newNotifs.push({
            id: `${incoming.id}-status-${Date.now()}`,
            message: `Order #${incoming.id.slice(0, 8).toUpperCase()} moved to ${incoming.status}`,
            time: new Date().toLocaleTimeString(),
          });
        }
        if (incoming.paymentStatus && incoming.paymentStatus !== existing.paymentStatus) {
          newNotifs.push({
            id: `${incoming.id}-payment-${Date.now()}`,
            message: `Payment for order #${incoming.id.slice(0, 8).toUpperCase()} is ${incoming.paymentStatus}`,
            time: new Date().toLocaleTimeString(),
          });
        }
        if (newNotifs.length) enqueueNotifications(newNotifs);
      } else {
        enqueueNotifications([
          {
            id: `${incoming.id}-new-${Date.now()}`,
            message: `New order #${incoming.id.slice(0, 8).toUpperCase()} placed`,
            time: new Date().toLocaleTimeString(),
          },
        ]);
      }

      updateSnapshot(nextOrder.id, nextOrder.status, nextOrder.paymentStatus);

      if (index === -1) {
        if (ordersPage !== 1) return prev;
        added = true;
        return [nextOrder, ...prev].slice(0, ordersLimit);
      }

      const next = [...prev];
      next[index] = nextOrder;
      return next;
    });

    if (added) {
      setOrdersTotal((prev) => {
        const nextTotal = prev + 1;
        setOrdersTotalPages(Math.max(1, Math.ceil(nextTotal / ordersLimit)));
        return nextTotal;
      });
    }
  };

  const fetchOrders = async (page = ordersPage) => {
    try {
      setLoading(true);
      const response = await apiClient.getOrdersPage(page, ordersLimit);
      if (response.success) {
        const nextOrders = response.data || [];
        setOrders(nextOrders);
        setOrdersTotal(response.pagination?.total || 0);
        setOrdersTotalPages(response.pagination?.totalPages || 1);

        if (typeof window !== 'undefined') {
          const snapshotRaw = localStorage.getItem('order_status_snapshot');
          const snapshot: Record<string, { status: string; paymentStatus: string }> = snapshotRaw ? JSON.parse(snapshotRaw) : {};
          const newNotifs: Array<{ id: string; message: string; time: string }> = [];

          nextOrders.forEach((order) => {
            const prev = snapshot[order.id];
            if (prev && prev.status !== order.status) {
              newNotifs.push({
                id: `${order.id}-status-${Date.now()}`,
                message: `Order #${order.id.slice(0, 8).toUpperCase()} moved to ${order.status}`,
                time: new Date().toLocaleTimeString(),
              });
            }
            if (prev && prev.paymentStatus !== order.paymentStatus) {
              newNotifs.push({
                id: `${order.id}-payment-${Date.now()}`,
                message: `Payment for order #${order.id.slice(0, 8).toUpperCase()} is ${order.paymentStatus}`,
                time: new Date().toLocaleTimeString(),
              });
            }
          });

          enqueueNotifications(newNotifs);

          const nextSnapshot: Record<string, { status: string; paymentStatus: string }> = {};
          nextOrders.forEach((order) => {
            nextSnapshot[order.id] = { status: order.status, paymentStatus: order.paymentStatus };
          });
          localStorage.setItem('order_status_snapshot', JSON.stringify(nextSnapshot));
        }
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

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Browser notifications are not supported');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      toast.success('Browser notifications enabled');
    } else if (permission === 'denied') {
      toast.error('Notifications blocked. Enable them in browser settings.');
    }
  };

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
        if (response.data) {
          applyOrderUpdate(response.data);
        }
      } else {
        throw new Error(response.error || 'Failed to apply coupon');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to apply coupon');
    } finally {
      setApplyingCouponOrderId(null);
    }
  };

  // Filter logic based on your custom status categories
  const activeOrders = orders.filter(o => !['COMPLETED', 'CANCELLED'].includes(o.status));
  const pastOrders = orders.filter(o => ['COMPLETED', 'CANCELLED'].includes(o.status));
  const displayOrders = activeTab === 'ACTIVE' ? activeOrders : pastOrders;

  return (
    <div className="min-h-screen bg-[#FDFDFD] pb-32">
      <div className="max-w-3xl mx-auto px-4 pt-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => router.back()} className="p-3 -ml-3 hover:bg-gray-50 rounded-full transition-colors active:scale-95">
            <ArrowLeft className="h-6 w-6 text-gray-900" />
          </button>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">My Orders</h1>
          <button
            onClick={() => fetchOrders(ordersPage)}
            disabled={loading}
            className="p-3 -mr-3 hover:bg-gray-50 rounded-full transition-colors disabled:opacity-50 text-orange-600"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* High-End Pill Navigation */}
        <div className="relative mb-6">
          <div className="flex p-1.5 bg-gray-100/80 rounded-2xl border border-gray-200/50">
            <button
              onClick={() => setActiveTab('ACTIVE')}
              className={`flex-1 py-3 text-sm font-black rounded-xl transition-all ${
                activeTab === 'ACTIVE' 
                ? 'bg-white text-orange-600 shadow-[0_2px_10px_rgb(0,0,0,0.06)]' 
                : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Active ({activeOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('PAST')}
              className={`flex-1 py-3 text-sm font-black rounded-xl transition-all ${
                activeTab === 'PAST' 
                ? 'bg-white text-gray-900 shadow-[0_2px_10px_rgb(0,0,0,0.06)]' 
                : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Past Orders
            </button>
          </div>
        </div>

        {/* Notifications Card */}
        {activeTab === 'ACTIVE' && notifications.length > 0 && (
          <div className="bg-orange-50/50 rounded-2xl border border-orange-100 p-4 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black text-orange-900 flex items-center gap-2">
                <BellRing className="h-4 w-4 text-orange-600" />
                Live Updates
              </h2>
              <button
                onClick={() => {
                  setNotifications([]);
                  if (typeof window !== 'undefined') localStorage.removeItem('order_notifications');
                }}
                className="text-xs font-bold text-orange-700 hover:text-orange-900 bg-orange-100 px-3 py-1 rounded-lg transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="space-y-2">
              {notifications.slice(0, 3).map((note) => (
                <div key={note.id} className="text-xs text-orange-800 flex items-center justify-between bg-white/60 p-2.5 rounded-xl border border-orange-100/50">
                  <span className="font-medium truncate pr-4">{note.message}</span>
                  <span className="text-[10px] font-bold opacity-60 whitespace-nowrap">{note.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Page {ordersPage} of {ordersTotalPages} <span className="mx-1">•</span> {ordersTotal} Total
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOrdersPage((prev) => Math.max(1, prev - 1))}
              disabled={ordersPage <= 1 || loading}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => setOrdersPage((prev) => Math.min(ordersTotalPages, prev + 1))}
              disabled={ordersPage >= ordersTotalPages || loading}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 font-bold text-sm">Syncing orders...</p>
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="bg-white rounded-[32px] border border-gray-100 p-10 text-center shadow-[0_4px_20px_rgb(0,0,0,0.02)] mt-4">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">No {activeTab.toLowerCase()} orders</h3>
            <p className="text-sm font-medium text-gray-500 mb-8">Looks like you haven't placed any orders here yet.</p>
            <button 
              onClick={() => router.push(apiClient.buildRestaurantPath('/menu'))}
              className="bg-orange-600 text-white px-8 py-3.5 rounded-xl font-black shadow-lg shadow-orange-500/20 active:scale-95 transition-transform"
            >
              Browse Menu
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {displayOrders.map((order) => {
              const badge = getStatusBadge(order.status);
              const BadgeIcon = badge.icon;
              const isOngoing = !['COMPLETED', 'CANCELLED'].includes(order.status);
              const canPayNow = order.paymentStatus !== 'COMPLETED' && order.paymentProvider !== 'CASH';
              
              // Ensure order.items exists before mapping to avoid crashes
              const itemsList = Array.isArray(order.items) ? order.items : [];
              const itemSummary = itemsList.length > 0 
                ? itemsList.map(i => `${i.quantity}x ${i.menuItem?.name || 'Item'}`).join(', ')
                : 'No items detailed';

              return (
                <div key={order.id} className="bg-white rounded-[32px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 transition-all hover:border-orange-200 group">
                  
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-4 border-b border-dashed border-gray-200 pb-4">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                        {formatOrderDate(order.createdAt || new Date().toISOString())}
                      </p>
                      <p className="font-black text-xl text-gray-900">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <div className={`flex flex-col items-end gap-2`}>
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${badge.color}`}>
                        <BadgeIcon className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-wider">{badge.label}</span>
                      </div>
                      <div className="text-xs font-bold text-gray-500 flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {order.paymentStatus}
                      </div>
                    </div>
                  </div>

                  {/* Order Details */}
                  <div className="mb-5">
                    <p className="text-sm font-bold text-gray-700 line-clamp-2 leading-relaxed bg-gray-50 p-4 rounded-2xl">
                      {itemSummary}
                    </p>
                    <div className="flex items-center gap-4 mt-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                      {order.table?.number && (
                        <span className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-lg text-gray-700">
                          <MapPin className="h-3.5 w-3.5" /> TBL {order.table.number}
                        </span>
                      )}
                      {order.estimatedTime && isOngoing && (
                        <span className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg border border-orange-100">
                          <Clock className="h-3.5 w-3.5" /> ~{order.estimatedTime} MIN
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details Toggle Button */}
                  <button 
                    onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)} 
                    className="w-full py-3 mb-4 flex items-center justify-between text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    <span>{selectedOrder === order.id ? 'Hide Details' : 'View Full Receipt'}</span>
                    <ChevronRight className={`h-4 w-4 transition-transform ${selectedOrder === order.id ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Expanded Receipt Details */}
                  {selectedOrder === order.id && (
                    <div className="bg-gray-900 text-white rounded-[24px] p-5 mb-5 shadow-inner">
                      <div className="space-y-3 mb-4">
                        {itemsList.map((item, index) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-3">
                              <span className="bg-white/10 px-2 py-1 rounded text-xs font-bold text-gray-300">{item.quantity}x</span>
                              <span className="font-medium text-gray-200">{item.menuItem?.name || 'Item'}</span>
                            </div>
                            <span className="font-bold">{formatInr(item.pricePaise * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-dashed border-gray-700 pt-3 space-y-2 text-xs font-medium text-gray-400">
                         <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>{formatInr(order.subtotalPaise || 0)}</span>
                          </div>
                          {order.discountPaise ? (
                            <div className="flex justify-between text-green-400">
                              <span>Discount</span>
                              <span>- {formatInr(order.discountPaise)}</span>
                            </div>
                          ) : null}
                          <div className="flex justify-between">
                            <span>Tax</span>
                            <span>{formatInr(order.taxPaise || 0)}</span>
                          </div>
                      </div>
                    </div>
                  )}

                  {/* Pay Now Expanded Section */}
                  {payNowOrderId === order.id && canPayNow && (
                    <div className="mt-2 mb-5 rounded-[24px] border-2 border-orange-500 bg-orange-50 p-5 shadow-lg shadow-orange-500/10">
                      <h4 className="font-black text-gray-900 mb-4 flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-orange-600" />
                        Complete Payment
                      </h4>
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                          <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400" />
                          <input
                            value={couponByOrder[order.id] || ''}
                            onChange={(e) => setCouponByOrder((prev) => ({ ...prev, [order.id]: e.target.value }))}
                            placeholder="Promo code"
                            className="w-full pl-10 pr-4 py-3 bg-white border border-orange-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-500/20"
                          />
                        </div>
                        <button
                          onClick={() => handleApplyCouponToOrder(order.id)}
                          disabled={applyingCouponOrderId === order.id}
                          className="px-6 py-3 bg-orange-200 text-orange-900 font-bold rounded-xl hover:bg-orange-300 disabled:opacity-60 text-sm whitespace-nowrap active:scale-95 transition-transform"
                        >
                          {applyingCouponOrderId === order.id ? 'Applying...' : 'Apply'}
                        </button>
                        <button
                          onClick={() => router.push(apiClient.buildRestaurantPath(`/checkout?orderId=${order.id}&payNow=1`))}
                          className="px-8 py-3 bg-orange-600 text-white font-black rounded-xl hover:bg-orange-700 text-sm whitespace-nowrap shadow-md shadow-orange-500/20 active:scale-95 transition-transform"
                        >
                          Pay {formatInr(order.totalPaise)}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Card Footer Actions */}
                  <div className="flex flex-wrap items-center justify-between pt-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Total</p>
                      <p className="text-2xl font-black text-gray-900">{formatInr(order.totalPaise)}</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {isOngoing && (
                        <button
                          onClick={() => router.push(apiClient.buildRestaurantPath(`/menu?orderId=${order.id}`))}
                          className="px-4 py-2.5 bg-gray-50 text-gray-900 rounded-xl hover:bg-gray-100 font-bold flex items-center text-sm transition-colors"
                        >
                          <PlusCircle className="h-4 w-4 mr-2" />
                          Add Items
                        </button>
                      )}

                      {canPayNow && (
                        <button
                          onClick={() => setPayNowOrderId(payNowOrderId === order.id ? null : order.id)}
                          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors border-2 ${
                            payNowOrderId === order.id 
                            ? 'bg-gray-900 text-white border-gray-900' 
                            : 'bg-white text-orange-600 border-orange-600 hover:bg-orange-50'
                          }`}
                        >
                          {payNowOrderId === order.id ? 'Cancel' : 'Pay Now'}
                        </button>
                      )}

                      {order.paymentProvider === 'CASH' && order.paymentStatus !== 'COMPLETED' && (
                        <div className="px-4 py-2.5 bg-orange-50 text-orange-800 rounded-xl border border-orange-200 text-xs font-bold flex items-center">
                          <Info className="h-4 w-4 mr-2" /> Cash pending confirmation
                        </div>
                      )}

                      {/* Download/Send Invoices for Completed Orders */}
                      {order.paymentStatus === 'COMPLETED' && (
                        <>
                          <button
                            onClick={() => handleDownloadInvoice(order.id)}
                            disabled={downloadingInvoice === order.id}
                            className="px-4 py-2.5 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 font-bold flex items-center text-sm transition-colors"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            {downloadingInvoice === order.id ? '...' : 'PDF'}
                          </button>
                          <button
                            onClick={() => handleSendInvoice(order.id)}
                            disabled={sendingInvoice === order.id}
                            className="px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-black font-bold flex items-center text-sm transition-colors"
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            {sendingInvoice === order.id ? '...' : 'Email'}
                          </button>
                        </>
                      )}
                    </div>
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