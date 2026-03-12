'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, Order } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';
import { ChefHat, RefreshCcw } from 'lucide-react';
import toast from 'react-hot-toast';

const statusFlow = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'];

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
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    let source: EventSource | null = null;
    try {
      source = new EventSource(apiClient.getEventStreamUrl(token));
    } catch {
      source = null;
    }

    if (!source) return;

    const onOrderUpdated = () => {
      fetchOrders();
    };

    source.addEventListener('order.created', onOrderUpdated);
    source.addEventListener('order.updated', onOrderUpdated);

    source.onerror = () => {
      // Browser will retry automatically; no-op
    };

    return () => {
      source?.close();
    };
  }, [hasKitchenAccess]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getRestaurantOrders();
      if (response.success) {
        const active = (response.data || []).filter((order) => !['COMPLETED', 'CANCELLED'].includes(order.status));
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
              newMessages.push(`New order #${order.id.slice(0, 8).toUpperCase()} awaiting confirmation`);
            }
            if (prev && prev.status !== order.status) {
              newMessages.push(`Order #${order.id.slice(0, 8).toUpperCase()} moved to ${order.status}`);
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
    return statusFlow.reduce((acc, status) => {
      acc[status] = orders.filter((order) => order.status === status);
      return acc;
    }, {} as Record<string, Order[]>);
  }, [orders]);

  const advanceStatus = async (order: Order) => {
    const currentIndex = statusFlow.indexOf(order.status);
    const nextStatus = statusFlow[currentIndex + 1];
    if (!nextStatus) return;

    try {
      setUpdatingOrderId(order.id);
      const response = await apiClient.updateOrderStatus(order.id, nextStatus);
      if (response.success) {
        toast.success(`Order moved to ${nextStatus}`);
        await fetchOrders();
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
        await fetchOrders();
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
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Kitchen Order Preparation</h1>
          </div>
          <button
            onClick={fetchOrders}
            className="inline-flex items-center px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-300 hover:bg-gray-100"
          >
            <RefreshCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-gray-600 text-sm">Loading kitchen queue...</p>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
              <h2 className="font-semibold text-gray-900 text-sm sm:text-base mb-3">Pending confirmations</h2>
              {(groupedOrders['PENDING'] || []).length === 0 ? (
                <p className="text-xs sm:text-sm text-gray-500">No orders waiting for confirmation.</p>
              ) : (
                <div className="space-y-2">
                  {(groupedOrders['PENDING'] || []).map((order) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">#{order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-gray-600 truncate">{order.user?.name || 'Customer'} - Table {order.table?.number}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => advanceStatus(order)}
                          disabled={updatingOrderId === order.id}
                          className="text-xs px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => cancelOrder(order)}
                          disabled={updatingOrderId === order.id}
                          className="text-xs px-3 py-1.5 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {['PENDING', 'CONFIRMED', 'PREPARING', 'READY'].map((status) => (
              <div key={status} className="bg-white rounded-xl border border-gray-200">
                <div className="p-2.5 sm:p-3 border-b border-gray-200">
                  <p className="font-semibold text-gray-800 text-sm sm:text-base">{status}</p>
                  <p className="text-xs text-gray-500">{groupedOrders[status]?.length || 0} orders</p>
                </div>
                <div className="p-2.5 sm:p-3 space-y-2 sm:space-y-3 max-h-[calc(100vh-200px)] overflow-auto">
                  {(groupedOrders[status] || []).length === 0 && (
                    <p className="text-xs sm:text-sm text-gray-500">No orders in this stage.</p>
                  )}
                  {(groupedOrders[status] || []).map((order) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-2.5 sm:p-3">
                      <p className="font-semibold text-gray-900 text-sm">#{order.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs text-gray-600 truncate">{order.user?.name || 'Customer'} - Table {order.table?.number}</p>
                      <div className="mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1">
                        {order.items.map((item) => (
                          <p key={item.id} className="text-xs sm:text-sm text-gray-700 truncate">
                            {item.quantity}x {item.menuItem?.name}
                          </p>
                        ))}
                      </div>
                      <div className="mt-2 sm:mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => advanceStatus(order)}
                          disabled={updatingOrderId === order.id}
                          className="w-full bg-orange-600 text-white py-1.5 sm:py-2 rounded-lg hover:bg-orange-700 disabled:opacity-60 text-xs sm:text-sm"
                        >
                          {updatingOrderId === order.id ? 'Updating...' : 'Next Stage'}
                        </button>
                        <button
                          onClick={() => cancelOrder(order)}
                          disabled={updatingOrderId === order.id}
                          className="w-full bg-red-50 text-red-700 border border-red-200 py-1.5 sm:py-2 rounded-lg hover:bg-red-100 disabled:opacity-60 text-xs sm:text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
