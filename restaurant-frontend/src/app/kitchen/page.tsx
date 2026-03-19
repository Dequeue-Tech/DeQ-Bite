'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, Order } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';
import { ChefHat, RefreshCcw, Clock, CheckCircle, Flame, ArrowRight, Utensils, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { subscribeToOrderEvents } from '@/lib/realtime-client';

// We only want the kitchen to manage the active cooking flow
const kitchenFlow = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'];

const getStatusColor = (status: Order['status']) => {
  const colors = {
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
    PREPARING: 'bg-purple-100 text-purple-800 border-purple-200',
    READY: 'bg-orange-100 text-orange-800 border-orange-200',
    SERVED: 'bg-teal-100 text-teal-800 border-teal-200',
    COMPLETED: 'bg-green-100 text-green-800 border-green-200',
    CANCELLED: 'bg-red-100 text-red-800 border-red-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'PENDING': return <Clock className="h-4 w-4" />;
    case 'CONFIRMED': return <CheckCircle className="h-4 w-4" />;
    case 'PREPARING': return <Flame className="h-4 w-4" />;
    case 'READY': return <Utensils className="h-4 w-4" />;
    default: return <Clock className="h-4 w-4" />;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'PENDING': return 'New Orders';
    case 'CONFIRMED': return 'Up Next';
    case 'PREPARING': return 'Cooking';
    case 'READY': return 'Ready to Serve';
    default: return status;
  }
};

export default function KitchenPage() {
  const router = useRouter();
  const { user, getProfile } = useAuthStore();
  const selectedRestaurantSlug = apiClient.getSelectedRestaurantSlug();
  const homeHref = selectedRestaurantSlug ? `/${selectedRestaurantSlug}` : '/';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const hasKitchenAccess = user?.restaurantRole === 'OWNER' || user?.restaurantRole === 'ADMIN' || user?.restaurantRole === 'STAFF';

  useEffect(() => {
    getProfile();
  }, [getProfile]);

  useEffect(() => {
    if (typeof user?.restaurantRole === 'undefined') return;
    if (!hasKitchenAccess) {
      router.push(homeHref);
      return;
    }
    fetchOrders();
  }, [user?.restaurantRole, hasKitchenAccess, router, homeHref]);

  useEffect(() => {
    if (!hasKitchenAccess || typeof window === 'undefined') return;
    const restaurantSlug = apiClient.getActiveRestaurantSlug();
    const cleanup = subscribeToOrderEvents({
      restaurant: restaurantSlug,
      scope: 'restaurant',
      onEvent: (event) => {
        const order = event?.payload?.order;
        if (!order?.id) return;
        handleRealtimeOrderUpdate(order);
      },
    });

    return cleanup;
  }, [hasKitchenAccess]);

  const handleRealtimeOrderUpdate = (incoming: Partial<Order> & { id: string }) => {
    const isActive = (status?: Order['status']) => status && !['COMPLETED', 'CANCELLED', 'SERVED'].includes(status);

    setOrders((prev) => {
      const index = prev.findIndex((order) => order.id === incoming.id);
      const existing = index >= 0 ? prev[index] : null;
      const nextOrder = existing
        ? {
            ...existing,
            ...incoming,
            items: incoming.items ?? existing.items,
            table: incoming.table ?? existing.table,
            user: incoming.user ?? existing.user,
          }
        : (incoming as Order);

      if (existing && incoming.status && incoming.status !== existing.status) {
        toast.success(`Order #${incoming.id.slice(0, 8).toUpperCase()} moved to ${incoming.status}`);
      }

      if (!isActive(nextOrder.status)) {
        return prev.filter((order) => order.id !== nextOrder.id);
      }

      if (index === -1) {
        return [nextOrder, ...prev];
      }

      const next = [...prev];
      next[index] = nextOrder as Order;
      return next;
    });
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getRestaurantOrders();
      if (response.success) {
        // Kitchen only needs to see active cooking stages
        const active = (response.data || []).filter((order) => kitchenFlow.includes(order.status));
        setOrders(active);

        if (typeof window !== 'undefined') {
          const nextOrders = active;
          const snapshotRaw = localStorage.getItem('kitchen_order_snapshot');
          const isInitialSnapshot = !snapshotRaw;
          const snapshot: Record<string, { status: string }> = snapshotRaw ? JSON.parse(snapshotRaw) : {};
          const newMessages: string[] = [];

          nextOrders.forEach((order) => {
            const prev = snapshot[order.id];
            if (!prev && !isInitialSnapshot) {
              newMessages.push(`New order #${order.id.slice(0, 8).toUpperCase()} awaiting kitchen`);
            }
          });

          if (newMessages.length) {
            newMessages.slice(0, 3).forEach((msg) => toast(msg));
          }

          const nextSnapshot: Record<string, { status: string }> = {};
          nextOrders.forEach((order) => {
            nextSnapshot[order.id] = { status: order.status };
          });
          localStorage.setItem('kitchen_order_snapshot', JSON.stringify(nextSnapshot));
        }
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to fetch kitchen orders');
    } finally {
      setLoading(false);
    }
  };

  const groupedOrders = useMemo(() => {
    return kitchenFlow.reduce((acc, status) => {
      acc[status] = orders.filter((order) => order.status === status);
      return acc;
    }, {} as Record<string, Order[]>);
  }, [orders]);

  const advanceStatus = async (order: Order) => {
    // Determine the complete flow to know what's next, even if kitchen doesn't show it
    const completeFlow = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'];
    const currentIndex = completeFlow.indexOf(order.status);
    const nextStatus = completeFlow[currentIndex + 1];
    if (!nextStatus) return;

    try {
      setUpdatingOrderId(order.id);
      const response = await apiClient.updateOrderStatus(order.id, nextStatus as Order['status']);
      if (response.success) {
        if (response.data) {
          handleRealtimeOrderUpdate(response.data);
        }
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update order');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const cancelOrder = async (order: Order) => {
    try {
      setUpdatingOrderId(order.id);
      const response = await apiClient.updateOrderStatus(order.id, 'CANCELLED');
      if (response.success) {
        toast.success('Order cancelled');
        if (response.data) {
          handleRealtimeOrderUpdate(response.data);
        }
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to cancel order');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (!hasKitchenAccess && typeof user?.restaurantRole !== 'undefined') {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Header Area */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2.5 rounded-xl text-white shadow-lg shadow-orange-500/20">
                <ChefHat className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-none">Kitchen Display</h1>
                <p className="text-sm font-medium text-gray-500 mt-1">Live order tracking</p>
              </div>
            </div>

            <button
              onClick={fetchOrders}
              disabled={loading}
              className="flex items-center justify-center gap-2 text-sm font-bold text-gray-700 bg-gray-100 px-5 py-2.5 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Board
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 font-bold">Syncing Orders...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {kitchenFlow.map((status) => {
              const columnOrders = groupedOrders[status] || [];
              const isPending = status === 'PENDING';
              
              return (
                <div key={status} className="flex flex-col h-full max-h-[calc(100vh-140px)]">
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${getStatusColor(status as Order['status']).split(' ')[0]} ${getStatusColor(status as Order['status']).split(' ')[1]}`}>
                        {getStatusIcon(status)}
                      </div>
                      <h2 className="font-black text-gray-900">{getStatusLabel(status)}</h2>
                    </div>
                    <span className="bg-gray-200 text-gray-700 text-xs font-black px-2.5 py-1 rounded-full">
                      {columnOrders.length}
                    </span>
                  </div>

                  {/* Kanban Column */}
                  <div className={`flex-1 rounded-[32px] p-4 sm:p-5 overflow-y-auto no-scrollbar border ${isPending ? 'bg-orange-50/50 border-orange-100' : 'bg-gray-100/50 border-gray-100'}`}>
                    
                    <style jsx global>{`
                      .no-scrollbar::-webkit-scrollbar { display: none; }
                      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                    `}</style>

                    {columnOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-center opacity-50">
                        <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 mb-2" />
                        <p className="text-xs font-bold text-gray-400">No tickets</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {columnOrders.map((order) => (
                          <div 
                            key={order.id} 
                            className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 group hover:border-orange-200 transition-colors"
                          >
                            {/* Order Ticket Header */}
                            <div className="flex items-start justify-between mb-4 border-b border-dashed border-gray-200 pb-4">
                              <div>
                                <p className="font-black text-lg text-gray-900 leading-none">#{order.id.slice(0, 6).toUpperCase()}</p>
                                <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">{order.user?.name || 'Walk-in'}</p>
                              </div>
                              {order.table?.number && (
                                <div className="bg-gray-900 text-white h-10 w-10 rounded-xl flex flex-col items-center justify-center shrink-0">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase leading-none">TBL</span>
                                  <span className="text-sm font-black leading-none mt-0.5">{order.table.number}</span>
                                </div>
                              )}
                            </div>

                            {/* Order Items (The "Ticket") */}
                            <div className="space-y-3 mb-6">
                              {order.items.map((item) => (
                                <div key={item.id} className="flex items-start gap-3">
                                  <div className="bg-orange-100 text-orange-700 font-black text-xs px-2 py-1 rounded-lg shrink-0">
                                    {item.quantity}x
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-800 leading-tight">{item.menuItem?.name}</p>
                                    {item.notes && (
                                      <p className="text-xs font-medium text-red-500 mt-0.5 flex items-center gap-1">
                                        <X className="h-3 w-3" /> {item.notes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {order.specialInstructions && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mt-4">
                                  <p className="text-[10px] font-black text-yellow-800 uppercase tracking-widest mb-1">Notes</p>
                                  <p className="text-xs font-bold text-yellow-900">{order.specialInstructions}</p>
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => advanceStatus(order)}
                                disabled={updatingOrderId === order.id}
                                className="flex-1 flex items-center justify-center gap-1.5 bg-gray-900 text-white py-3 rounded-xl font-bold text-xs hover:bg-black active:scale-95 transition-all disabled:opacity-50"
                              >
                                {updatingOrderId === order.id ? (
                                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    {isPending ? 'Accept Order' : 'Move to Next'} 
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </>
                                )}
                              </button>
                              
                              {isPending && (
                                <button
                                  onClick={() => cancelOrder(order)}
                                  disabled={updatingOrderId === order.id}
                                  className="px-4 py-3 bg-white text-red-600 border border-red-200 rounded-xl font-bold text-xs hover:bg-red-50 active:scale-95 transition-all disabled:opacity-50"
                                >
                                  Decline
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
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