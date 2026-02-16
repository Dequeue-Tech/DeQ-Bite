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
      router.push('/');
      return;
    }
    fetchOrders();
  }, [user?.restaurantRole, hasKitchenAccess, router]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getRestaurantOrders();
      if (response.success) {
        const active = (response.data || []).filter((order) => !['COMPLETED', 'CANCELLED'].includes(order.status));
        setOrders(active);
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

  if (!hasKitchenAccess && typeof user?.restaurantRole !== 'undefined') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-orange-600" />
            <h1 className="text-2xl font-bold text-gray-900">Kitchen Order Preparation</h1>
          </div>
          <button
            onClick={fetchOrders}
            className="inline-flex items-center px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-100"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-gray-600">Loading kitchen queue...</p>
        ) : (
          <div className="grid lg:grid-cols-3 gap-4">
            {['PENDING', 'CONFIRMED', 'PREPARING', 'READY'].map((status) => (
              <div key={status} className="bg-white rounded-xl border border-gray-200">
                <div className="p-3 border-b border-gray-200">
                  <p className="font-semibold text-gray-800">{status}</p>
                  <p className="text-xs text-gray-500">{groupedOrders[status]?.length || 0} orders</p>
                </div>
                <div className="p-3 space-y-3">
                  {(groupedOrders[status] || []).length === 0 && (
                    <p className="text-sm text-gray-500">No orders in this stage.</p>
                  )}
                  {(groupedOrders[status] || []).map((order) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-3">
                      <p className="font-semibold text-gray-900">#{order.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-sm text-gray-600">{order.user?.name || 'Customer'} - Table {order.table?.number}</p>
                      <div className="mt-2 space-y-1">
                        {order.items.map((item) => (
                          <p key={item.id} className="text-sm text-gray-700">
                            {item.quantity}x {item.menuItem?.name}
                          </p>
                        ))}
                      </div>
                      <button
                        onClick={() => advanceStatus(order)}
                        disabled={updatingOrderId === order.id}
                        className="mt-3 w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:opacity-60"
                      >
                        {updatingOrderId === order.id ? 'Updating...' : 'Move to Next Stage'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
