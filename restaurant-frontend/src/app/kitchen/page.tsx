'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, KOTOperationalSummary, KOTStatus, KOTTicket } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';
import { ChefHat, RefreshCcw, Clock, Flame, Utensils, ArrowRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { subscribeToRestaurantEvents } from '@/lib/realtime-client';

const kitchenFlow: KOTStatus[] = ['PLACED', 'PREPARING', 'READY'];
const nextStatusMap: Record<KOTStatus, KOTStatus | null> = {
  PLACED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'SERVED',
  SERVED: null,
};

const getStatusColor = (status: KOTStatus) => {
  const colors: Record<KOTStatus, string> = {
    PLACED: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    PREPARING: 'bg-purple-100 text-purple-800 border-purple-200',
    READY: 'bg-orange-100 text-orange-800 border-orange-200',
    SERVED: 'bg-teal-100 text-teal-800 border-teal-200',
  };
  return colors[status];
};

const getStatusIcon = (status: KOTStatus) => {
  if (status === 'PLACED') return <Clock className="h-4 w-4" />;
  if (status === 'PREPARING') return <Flame className="h-4 w-4" />;
  if (status === 'READY') return <Utensils className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
};

const getStatusLabel = (status: KOTStatus) => {
  if (status === 'PLACED') return 'Placed';
  if (status === 'PREPARING') return 'Preparing';
  if (status === 'READY') return 'Ready';
  return 'Served';
};

export default function KitchenPage() {
  const router = useRouter();
  const { user, getProfile } = useAuthStore();
  const selectedRestaurantSlug = apiClient.getSelectedRestaurantSlug();
  const homeHref = selectedRestaurantSlug ? `/${selectedRestaurantSlug}` : '/';

  const [tickets, setTickets] = useState<KOTTicket[]>([]);
  const [summary, setSummary] = useState<KOTOperationalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const hasKitchenAccess =
    user?.restaurantRole === 'OWNER' || user?.restaurantRole === 'ADMIN' || user?.restaurantRole === 'STAFF';

  useEffect(() => {
    getProfile();
  }, [getProfile]);

  useEffect(() => {
    if (typeof user?.restaurantRole === 'undefined') return;
    if (!hasKitchenAccess) {
      router.push(homeHref);
      return;
    }
    void refreshBoard();
  }, [user?.restaurantRole, hasKitchenAccess, router, homeHref]);

  useEffect(() => {
    if (!hasKitchenAccess || typeof window === 'undefined') return;
    const restaurantSlug = apiClient.getActiveRestaurantSlug();
    const cleanup = subscribeToRestaurantEvents({
      restaurant: restaurantSlug,
      role: 'staff',
      eventTypes: ['kot.created', 'kot.updated', 'kot.priority.updated', 'order.created', 'order.updated'],
      onEvent: (event) => {
        const ticket = (event?.payload as any)?.ticket as KOTTicket | undefined;
        const orderId =
          ((event?.payload as any)?.orderId as string | undefined) ||
          ((event?.payload as any)?.order_id as string | undefined) ||
          ((event?.payload as any)?.order?.id as string | undefined);

        if (ticket?.orderId) {
          mergeTicket(ticket);
          void loadSummary();
          return;
        }

        if (orderId && event.type.startsWith('kot.')) {
          void refreshSingleTicket(orderId);
          void loadSummary();
          return;
        }

        if ((event.type === 'order.created' || event.type === 'order.updated') && orderId) {
          void refreshSingleTicket(orderId);
          void loadSummary();
        }
      },
      onReconnect: ({ lastSyncTimestamp }) => {
        if (!lastSyncTimestamp) return;
        void syncDeltaFromTimestamp(lastSyncTimestamp);
      },
    });

    return cleanup;
  }, [hasKitchenAccess]);

  const mergeTicket = (incoming: KOTTicket) => {
    setTickets((prev) => {
      const index = prev.findIndex((ticket) => ticket.id === incoming.id || ticket.orderId === incoming.orderId);
      const next = [...prev];
      if (incoming.status === 'SERVED') {
        if (index >= 0) next.splice(index, 1);
        return next;
      }

      if (index === -1) {
        next.unshift(incoming);
        return next;
      }

      next[index] = {
        ...next[index],
        ...incoming,
        order: incoming.order ?? next[index].order,
        events: incoming.events ?? next[index].events,
      };
      return next;
    });
  };

  const refreshSingleTicket = async (orderId: string) => {
    try {
      const ticket = await apiClient.getKotTicketByOrder(orderId);
      mergeTicket(ticket);
    } catch {
      setTickets((prev) => prev.filter((ticket) => ticket.orderId !== orderId));
    }
  };

  const syncDeltaFromTimestamp = async (updatedAfter: string) => {
    try {
      const response = await apiClient.getRestaurantOrders('ALL', updatedAfter);
      if (!response.success || !response.data?.length) return;
      response.data.forEach((order) => {
        void refreshSingleTicket(order.id);
      });
      void loadSummary();
    } catch {
      // Ignore reconnect delta failures; stream events continue.
    }
  };

  const loadSummary = async () => {
    try {
      const nextSummary = await apiClient.getKotSummary();
      setSummary(nextSummary);
    } catch {
      // Keep board resilient even if summary endpoint fails.
    }
  };

  const refreshBoard = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const [all, nextSummary] = await Promise.all([
        apiClient.getKotTickets(),
        apiClient.getKotSummary(),
      ]);
      setTickets(all.filter((ticket) => ticket.status !== 'SERVED'));
      setSummary(nextSummary);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to fetch KOT tickets');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const groupedTickets = useMemo(() => {
    return kitchenFlow.reduce((acc, status) => {
      acc[status] = tickets.filter((ticket) => ticket.status === status);
      return acc;
    }, {} as Record<KOTStatus, KOTTicket[]>);
  }, [tickets]);

  const advanceStatus = async (ticket: KOTTicket) => {
    const nextStatus = nextStatusMap[ticket.status];
    if (!nextStatus) return;

    try {
      setUpdatingOrderId(ticket.orderId);
      const updated = await apiClient.updateKotStatus(
        ticket.orderId,
        nextStatus,
        undefined,
        ticket.order?.updatedAt ? { expectedUpdatedAt: ticket.order.updatedAt } : undefined
      );
      mergeTicket(updated);
      if (nextStatus === 'SERVED') {
        toast.success(`Ticket #${ticket.id.slice(0, 8).toUpperCase()} served`);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update KOT status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const changePriority = async (ticket: KOTTicket, delta: number) => {
    try {
      const nextPriority = Math.max(-5, Math.min(5, ticket.priority + delta));
      await apiClient.updateKotPriority(ticket.orderId, nextPriority);
      await refreshSingleTicket(ticket.orderId);
      await loadSummary();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update ticket priority');
    }
  };

  if (!hasKitchenAccess && typeof user?.restaurantRole !== 'undefined') {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2.5 rounded-xl text-white shadow-lg shadow-orange-500/20">
                <ChefHat className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-none">Kitchen KOT Board</h1>
                <p className="text-sm font-medium text-gray-500 mt-1">Live ticket flow: placed -&gt; preparing -&gt; ready -&gt; served</p>
              </div>
            </div>

            <button
              onClick={() => void refreshBoard()}
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
            <p className="text-gray-500 font-bold">Syncing KOT tickets...</p>
          </div>
        ) : (
          <>
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div className="bg-white border border-gray-200 rounded-2xl p-3">
                  <p className="text-[11px] uppercase font-bold text-gray-500">Active Queue</p>
                  <p className="text-2xl font-black text-gray-900">{summary.queue.totalActive}</p>
                </div>
                <div className="bg-white border border-red-200 rounded-2xl p-3">
                  <p className="text-[11px] uppercase font-bold text-red-500">Overdue</p>
                  <p className="text-2xl font-black text-red-700">{summary.queue.overdueCount}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-3">
                  <p className="text-[11px] uppercase font-bold text-gray-500">Avg Prep</p>
                  <p className="text-2xl font-black text-gray-900">{summary.queue.avgPrepMinutesToday} min</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-3">
                  <p className="text-[11px] uppercase font-bold text-gray-500">Throughput</p>
                  <p className="text-2xl font-black text-gray-900">{summary.queue.throughputLastHour}/hr</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
              {kitchenFlow.map((status) => {
                const columnTickets = groupedTickets[status] || [];
                return (
                  <div key={status} className="flex flex-col h-full max-h-[calc(100vh-140px)]">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${getStatusColor(status).split(' ')[0]} ${getStatusColor(status).split(' ')[1]}`}>
                          {getStatusIcon(status)}
                        </div>
                        <h2 className="font-black text-gray-900">{getStatusLabel(status)}</h2>
                      </div>
                      <span className="bg-gray-200 text-gray-700 text-xs font-black px-2.5 py-1 rounded-full">{columnTickets.length}</span>
                    </div>
                    <div className="flex-1 rounded-[32px] p-4 sm:p-5 overflow-y-auto no-scrollbar border bg-gray-100/50 border-gray-100">
                      <style jsx global>{`
                        .no-scrollbar::-webkit-scrollbar { display: none; }
                        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                      `}</style>

                      {columnTickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-center opacity-50">
                          <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 mb-2" />
                          <p className="text-xs font-bold text-gray-400">No tickets</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {columnTickets.map((ticket) => (
                            <div key={ticket.id} className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 group hover:border-orange-200 transition-colors">
                              <div className="flex items-start justify-between mb-4 border-b border-dashed border-gray-200 pb-4">
                                <div>
                                  <p className="font-black text-lg text-gray-900 leading-none">#{ticket.id.slice(0, 6).toUpperCase()}</p>
                                  <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">
                                    {ticket.order?.user?.name || 'Walk-in'}
                                  </p>
                                  <p className="text-[11px] text-gray-500 mt-1">Priority {ticket.priority}</p>
                                </div>
                                {ticket.order?.table?.number && (
                                  <div className="bg-gray-900 text-white h-10 w-10 rounded-xl flex flex-col items-center justify-center shrink-0">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase leading-none">TBL</span>
                                    <span className="text-sm font-black leading-none mt-0.5">{ticket.order.table.number}</span>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-3 mb-6">
                                {(ticket.order?.items || []).map((item) => (
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

                                {ticket.order?.specialInstructions && (
                                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mt-4">
                                    <p className="text-[10px] font-black text-yellow-800 uppercase tracking-widest mb-1">Notes</p>
                                    <p className="text-xs font-bold text-yellow-900">{ticket.order.specialInstructions}</p>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mb-3">
                                <button
                                  onClick={() => void changePriority(ticket, -1)}
                                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50"
                                >
                                  - Priority
                                </button>
                                <button
                                  onClick={() => void changePriority(ticket, 1)}
                                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50"
                                >
                                  + Priority
                                </button>
                              </div>

                              <button
                                onClick={() => void advanceStatus(ticket)}
                                disabled={updatingOrderId === ticket.orderId}
                                className="w-full flex items-center justify-center gap-1.5 bg-gray-900 text-white py-3 rounded-xl font-bold text-xs hover:bg-black active:scale-95 transition-all disabled:opacity-50"
                              >
                                {updatingOrderId === ticket.orderId ? (
                                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    Move to {nextStatusMap[ticket.status] || 'Done'}
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
