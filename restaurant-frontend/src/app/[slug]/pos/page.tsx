'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  CirclePlus,
  Clock3,
  RefreshCcw,
  Search,
  ShieldAlert,
  Ticket,
  Trash2,
  TrendingUp,
  Users,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AnalyticsOverview,
  AnalyticsSnapshot,
  CrmOverview,
  CustomerProfile,
  InventoryAlert,
  KOTOperationalSummary,
  MarketplaceOrderSummary,
  MarketplacePaymentStatus,
  MarketplaceSourceSystem,
  MenuItem,
  PosSyncLog,
  RawMaterial,
  apiClient,
} from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';
import { formatInr } from '@/lib/currency';

const crmSegmentOptions = ['ALL', 'NEW', 'LOYAL', 'HIGH_VALUE', 'AT_RISK', 'REGULAR'] as const;
type CrmSegmentFilter = typeof crmSegmentOptions[number];
const marketplacePlatforms = ['ZOMATO', 'SWIGGY'] as const;
type MarketplacePlatformFilter = 'ALL' | MarketplaceSourceSystem;
const marketplacePaymentStatuses: MarketplacePaymentStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED'];

export default function PosOpsPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const { user, getProfile } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [daily, setDaily] = useState<AnalyticsSnapshot | null>(null);
  const [weekly, setWeekly] = useState<AnalyticsSnapshot | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [kotSummary, setKotSummary] = useState<KOTOperationalSummary | null>(null);
  const [crmOverview, setCrmOverview] = useState<CrmOverview | null>(null);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [syncLogs, setSyncLogs] = useState<PosSyncLog[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [marketplaceOrders, setMarketplaceOrders] = useState<MarketplaceOrderSummary[]>([]);
  const [syncingMarketplaceOrder, setSyncingMarketplaceOrder] = useState(false);
  const [marketplaceFilter, setMarketplaceFilter] = useState<MarketplacePlatformFilter>('ALL');
  const [customerQuery, setCustomerQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<CrmSegmentFilter>('ALL');
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [rawMaterialForm, setRawMaterialForm] = useState({
    name: '',
    unit: 'kg',
    currentStock: '0',
    reorderLevel: '0',
    costPerUnitPaise: '0',
  });

  const [marketplaceForm, setMarketplaceForm] = useState({
    sourceSystem: 'ZOMATO' as MarketplaceSourceSystem,
    externalOrderId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    customerLandmark: '',
    paymentProvider: 'CASH' as 'RAZORPAY' | 'PAYTM' | 'PHONEPE' | 'CASH',
    paymentStatus: 'PENDING' as MarketplacePaymentStatus,
    specialInstructions: '',
  });
  const [marketplaceItems, setMarketplaceItems] = useState<Array<{ menuItemId: string; quantity: string; notes: string }>>([
    { menuItemId: '', quantity: '1', notes: '' },
  ]);

  const canAccess =
    user?.restaurantRole === 'OWNER' || user?.restaurantRole === 'ADMIN' || user?.restaurantRole === 'STAFF';

  useEffect(() => {
    getProfile();
  }, [getProfile]);

  useEffect(() => {
    if (!slug) return;
    apiClient.setSelectedRestaurantSlug(slug);
  }, [slug]);

  useEffect(() => {
    if (typeof user?.restaurantRole === 'undefined') return;
    if (!canAccess) {
      router.replace(slug ? `/${slug}` : '/');
      return;
    }
    void loadAll(false);
  }, [user?.restaurantRole, canAccess, router, slug]);

  const loadCustomers = async (showLoader = false) => {
    try {
      if (showLoader) setLoadingCustomers(true);
      const filtered = await apiClient.getCustomersAdvanced({
        q: customerQuery.trim() || undefined,
        segment: segmentFilter === 'ALL' ? undefined : segmentFilter,
        sortBy: 'LOYALTY',
        direction: 'desc',
        page: 1,
        limit: 24,
      });
      setCustomers(filtered.data);
      setCustomersTotal(filtered.pagination?.total || filtered.data.length);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load customers');
    } finally {
      if (showLoader) setLoadingCustomers(false);
    }
  };

  const loadAll = async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const [
        dailySnapshot,
        weeklySnapshot,
        analyticsOverview,
        kot,
        crm,
        openAlerts,
        rawMaterials,
        customersPage,
        logs,
        menuItemsResponse,
        importedMarketplaceOrders,
      ] = await Promise.all([
        apiClient.getDailyAnalytics(),
        apiClient.getWeeklyAnalytics(),
        apiClient.getAnalyticsOverview(),
        apiClient.getKotSummary(),
        apiClient.getCrmOverview(),
        apiClient.getInventoryAlerts(true),
        apiClient.getRawMaterials(),
        apiClient.getCustomersAdvanced({
          sortBy: 'LOYALTY',
          direction: 'desc',
          page: 1,
          limit: 24,
        }),
        apiClient.getPosSyncLogs(),
        apiClient.getMenuItems(),
        apiClient.getMarketplaceOrders({ limit: 30 }),
      ]);

      setDaily(dailySnapshot);
      setWeekly(weeklySnapshot);
      setOverview(analyticsOverview);
      setKotSummary(kot);
      setCrmOverview(crm);
      setAlerts(openAlerts);
      setMaterials(rawMaterials);
      setCustomers(customersPage.data);
      setCustomersTotal(customersPage.pagination?.total || customersPage.data.length);
      setSyncLogs(logs);
      setMenuItems(menuItemsResponse.data || []);
      setMarketplaceOrders(importedMarketplaceOrders);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load POS operations data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const lowStockCount = useMemo(
    () => materials.filter((material) => material.currentStock <= material.reorderLevel).length,
    [materials]
  );

  const syncSuccessRate = useMemo(() => {
    if (syncLogs.length === 0) return 100;
    const success = syncLogs.filter((log) => log.status === 'SUCCESS').length;
    return Math.round((success / syncLogs.length) * 100);
  }, [syncLogs]);

  const filteredMarketplaceOrders = useMemo(() => {
    if (marketplaceFilter === 'ALL') return marketplaceOrders;
    return marketplaceOrders.filter((order) => order.sourceSystem === marketplaceFilter);
  }, [marketplaceOrders, marketplaceFilter]);

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await apiClient.acknowledgeInventoryAlert(alertId);
      setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
      toast.success('Alert acknowledged');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to acknowledge alert');
    }
  };

  const handleCreateRawMaterial = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const created = await apiClient.createRawMaterial({
        name: rawMaterialForm.name.trim(),
        unit: rawMaterialForm.unit.trim(),
        currentStock: Number(rawMaterialForm.currentStock || 0),
        reorderLevel: Number(rawMaterialForm.reorderLevel || 0),
        costPerUnitPaise: Number(rawMaterialForm.costPerUnitPaise || 0),
      });
      setMaterials((prev) => [created, ...prev]);
      setRawMaterialForm({
        name: '',
        unit: 'kg',
        currentStock: '0',
        reorderLevel: '0',
        costPerUnitPaise: '0',
      });
      toast.success('Raw material added');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create raw material');
    }
  };

  const handleCustomerFilter = async (e: FormEvent) => {
    e.preventDefault();
    await loadCustomers(true);
  };

  const addMarketplaceItem = () => {
    setMarketplaceItems((prev) => [...prev, { menuItemId: '', quantity: '1', notes: '' }]);
  };

  const removeMarketplaceItem = (index: number) => {
    setMarketplaceItems((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const handleMarketplaceItemChange = (index: number, field: 'menuItemId' | 'quantity' | 'notes', value: string) => {
    setMarketplaceItems((prev) =>
      prev.map((item, currentIndex) => (currentIndex === index ? { ...item, [field]: value } : item))
    );
  };

  const handleMarketplaceOrderSync = async (e: FormEvent) => {
    e.preventDefault();

    const payloadItems = marketplaceItems
      .map((item) => ({
        menuItemId: item.menuItemId.trim(),
        quantity: Number(item.quantity),
        notes: item.notes.trim(),
      }))
      .filter((item) => item.menuItemId.length > 0 && Number.isInteger(item.quantity) && item.quantity > 0)
      .map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        ...(item.notes ? { notes: item.notes } : {}),
      }));

    if (!marketplaceForm.externalOrderId.trim()) {
      toast.error('External order ID is required');
      return;
    }
    if (!marketplaceForm.customerName.trim() || !marketplaceForm.customerAddress.trim()) {
      toast.error('Customer name and address are required');
      return;
    }
    if (payloadItems.length === 0) {
      toast.error('Add at least one valid order item');
      return;
    }

    try {
      setSyncingMarketplaceOrder(true);
      await apiClient.syncMarketplaceOrder(marketplaceForm.sourceSystem, {
        externalOrderId: marketplaceForm.externalOrderId.trim(),
        customer: {
          name: marketplaceForm.customerName.trim(),
          address: marketplaceForm.customerAddress.trim(),
          ...(marketplaceForm.customerPhone.trim() ? { phone: marketplaceForm.customerPhone.trim() } : {}),
          ...(marketplaceForm.customerEmail.trim() ? { email: marketplaceForm.customerEmail.trim() } : {}),
          ...(marketplaceForm.customerLandmark.trim() ? { landmark: marketplaceForm.customerLandmark.trim() } : {}),
        },
        items: payloadItems,
        paymentProvider: marketplaceForm.paymentProvider,
        paymentStatus: marketplaceForm.paymentStatus,
        ...(marketplaceForm.specialInstructions.trim()
          ? { specialInstructions: marketplaceForm.specialInstructions.trim() }
          : {}),
      });

      toast.success(`${marketplaceForm.sourceSystem} order synced successfully`);
      setMarketplaceForm((prev) => ({
        ...prev,
        externalOrderId: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        customerAddress: '',
        customerLandmark: '',
        paymentStatus: 'PENDING',
        specialInstructions: '',
      }));
      setMarketplaceItems([{ menuItemId: '', quantity: '1', notes: '' }]);
      await loadAll(true);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to sync marketplace order');
    } finally {
      setSyncingMarketplaceOrder(false);
    }
  };

  if (!canAccess && typeof user?.restaurantRole !== 'undefined') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900">POS Operations</h1>
            <p className="text-sm text-slate-600">KOT, inventory, CRM, and analytics control center</p>
          </div>
          <button
            onClick={() => void loadAll(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-semibold disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 font-semibold">
            Loading POS operations...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 mb-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase"><BarChart3 className="h-4 w-4" /> Today Revenue</div>
                <p className="text-xl font-black mt-2">{formatInr(daily?.revenuePaise || 0)}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase"><TrendingUp className="h-4 w-4" /> 7d Revenue</div>
                <p className="text-xl font-black mt-2">{formatInr(overview?.summary.revenuePaise || 0)}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase"><Ticket className="h-4 w-4" /> Active KOT</div>
                <p className="text-xl font-black mt-2">{kotSummary?.queue.totalActive || 0}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase"><ShieldAlert className="h-4 w-4" /> Overdue KOT</div>
                <p className="text-xl font-black mt-2">{kotSummary?.queue.overdueCount || 0}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase"><AlertTriangle className="h-4 w-4" /> Open Alerts</div>
                <p className="text-xl font-black mt-2">{alerts.length}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase"><Activity className="h-4 w-4" /> POS Sync Health</div>
                <p className="text-xl font-black mt-2">{syncSuccessRate}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <section className="bg-white border border-slate-200 rounded-2xl p-5">
                <h2 className="font-black text-slate-900 mb-3">Analytics Intelligence</h2>
                <p className="text-sm text-slate-700 mb-2">{daily?.insights || 'No daily insights available yet.'}</p>
                <p className="text-sm text-slate-700 mb-4">{weekly?.recommendations || 'No weekly recommendations available yet.'}</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-100 p-3">
                    <p className="text-slate-500 font-semibold">Revenue Delta</p>
                    <p className={`font-black ${(overview?.deltas.revenuePct || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {overview ? `${overview.deltas.revenuePct}%` : '-'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-100 p-3">
                    <p className="text-slate-500 font-semibold">Repeat Ratio</p>
                    <p className="font-black text-slate-900">{overview?.summary.repeatCustomerRatePct || 0}%</p>
                  </div>
                  <div className="rounded-xl bg-slate-100 p-3">
                    <p className="text-slate-500 font-semibold">Cancellation</p>
                    <p className="font-black text-slate-900">{overview?.summary.cancellationRatePct || 0}%</p>
                  </div>
                  <div className="rounded-xl bg-slate-100 p-3">
                    <p className="text-slate-500 font-semibold">Payment Complete</p>
                    <p className="font-black text-slate-900">{overview?.summary.paymentCompletionRatePct || 0}%</p>
                  </div>
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-2xl p-5">
                <h2 className="font-black text-slate-900 mb-3">KOT Queue Intelligence</h2>
                {kotSummary ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {(['PLACED', 'PREPARING', 'READY'] as const).map((status) => (
                        <div key={status} className="rounded-xl border border-slate-200 px-3 py-2">
                          <p className="text-[11px] font-bold text-slate-500">{status}</p>
                          <p className="text-lg font-black text-slate-900">{kotSummary.queue.byStatus[status] || 0}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mb-3">
                      Avg prep today: {kotSummary.queue.avgPrepMinutesToday} min | Throughput last hour: {kotSummary.queue.throughputLastHour}
                    </p>
                    <div className="space-y-2 max-h-40 overflow-auto">
                      {kotSummary.topAgingTickets.slice(0, 6).map((ticket) => (
                        <div key={ticket.id} className={`rounded-xl border p-2.5 ${ticket.overdue ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
                          <p className="text-xs font-bold text-slate-900">
                            T{ticket.tableNumber} - {ticket.customerName}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            {ticket.status} | {ticket.minutesOpen} min open | Priority {ticket.priority}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">KOT summary unavailable.</p>
                )}
              </section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <section className="bg-white border border-slate-200 rounded-2xl p-5 lg:col-span-2">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="font-black text-slate-900 flex items-center gap-2"><Users className="h-4 w-4" /> CRM Command</h2>
                  <span className="text-xs font-semibold text-slate-500">{customersTotal} customers</span>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {(crmOverview?.summary.segments || []).map((segment) => (
                    <span key={segment.segment} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {segment.segment}: {segment.count}
                    </span>
                  ))}
                </div>

                <form onSubmit={handleCustomerFilter} className="flex flex-col sm:flex-row gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      placeholder="Search by name/email/phone"
                      className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm"
                    />
                  </div>
                  <select
                    value={segmentFilter}
                    onChange={(e) => setSegmentFilter(e.target.value as CrmSegmentFilter)}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  >
                    {crmSegmentOptions.map((segment) => (
                      <option key={segment} value={segment}>
                        {segment}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={loadingCustomers}
                    className="bg-slate-900 text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60"
                  >
                    {loadingCustomers ? 'Filtering...' : 'Filter'}
                  </button>
                </form>

                <div className="space-y-2 max-h-80 overflow-auto">
                  {customers.slice(0, 16).map((profile) => (
                    <div key={profile.id} className="border border-slate-100 rounded-xl p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{profile.user?.name || profile.userId}</p>
                          <p className="text-xs text-slate-500">
                            Tier {profile.tier} | Segment {profile.segment || 'REGULAR'}
                          </p>
                        </div>
                        <span className={`text-[11px] font-bold ${
                          profile.health?.risk === 'HIGH'
                            ? 'text-red-600'
                            : profile.health?.risk === 'MEDIUM'
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                        }`}>
                          Risk {profile.health?.risk || 'LOW'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Points: {profile.loyaltyPoints} | Orders: {profile.totalOrders} | Spend: {formatInr(profile.totalSpendPaise)}
                      </p>
                    </div>
                  ))}
                  {customers.length === 0 && (
                    <p className="text-sm text-slate-500">No customers found for the selected filter.</p>
                  )}
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-2xl p-5">
                <h2 className="font-black text-slate-900 mb-3">Inventory Alerts</h2>
                {alerts.length === 0 ? (
                  <p className="text-sm text-slate-500">No open alerts.</p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-auto">
                    {alerts.slice(0, 10).map((alert) => (
                      <div key={alert.id} className="border border-amber-200 bg-amber-50 rounded-xl p-3">
                        <p className="text-sm font-bold text-amber-900">{alert.rawMaterial?.name || alert.rawMaterialId}</p>
                        <p className="text-xs text-amber-800">
                          Current: {alert.currentValue} {alert.rawMaterial?.unit || ''} | Threshold: {alert.thresholdValue ?? '-'}
                        </p>
                        <button
                          onClick={() => void handleAcknowledgeAlert(alert.id)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Acknowledge
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <section className="bg-white border border-slate-200 rounded-2xl p-5">
                <h2 className="font-black text-slate-900 mb-3 flex items-center gap-2"><Boxes className="h-4 w-4" /> Add Raw Material</h2>
                <form onSubmit={handleCreateRawMaterial} className="space-y-3">
                  <input
                    required
                    value={rawMaterialForm.name}
                    onChange={(e) => setRawMaterialForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Name"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                  <input
                    required
                    value={rawMaterialForm.unit}
                    onChange={(e) => setRawMaterialForm((prev) => ({ ...prev, unit: e.target.value }))}
                    placeholder="Unit (kg/ltr/pcs)"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                  <input
                    value={rawMaterialForm.currentStock}
                    onChange={(e) => setRawMaterialForm((prev) => ({ ...prev, currentStock: e.target.value }))}
                    placeholder="Current stock"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                  <input
                    value={rawMaterialForm.reorderLevel}
                    onChange={(e) => setRawMaterialForm((prev) => ({ ...prev, reorderLevel: e.target.value }))}
                    placeholder="Reorder level"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                  <input
                    value={rawMaterialForm.costPerUnitPaise}
                    onChange={(e) => setRawMaterialForm((prev) => ({ ...prev, costPerUnitPaise: e.target.value }))}
                    placeholder="Cost per unit (paise)"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                  <button type="submit" className="w-full bg-slate-900 text-white rounded-xl py-2 text-sm font-bold">
                    Save Material
                  </button>
                </form>
                <div className="mt-4 rounded-xl bg-slate-100 p-3">
                  <p className="text-xs font-semibold text-slate-500">Low stock SKUs</p>
                  <p className="text-2xl font-black text-slate-900">{lowStockCount}</p>
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-2xl p-5 lg:col-span-2">
                <h2 className="font-black text-slate-900 mb-4">Marketplace Integrations</h2>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
                  <form onSubmit={handleMarketplaceOrderSync} className="border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={marketplaceForm.sourceSystem}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({
                            ...prev,
                            sourceSystem: e.target.value as MarketplaceSourceSystem,
                          }))
                        }
                        className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                      >
                        {marketplacePlatforms.map((platform) => (
                          <option key={platform} value={platform}>
                            {platform}
                          </option>
                        ))}
                      </select>
                      <input
                        required
                        value={marketplaceForm.externalOrderId}
                        onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, externalOrderId: e.target.value }))}
                        placeholder="External order ID"
                        className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        required
                        value={marketplaceForm.customerName}
                        onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, customerName: e.target.value }))}
                        placeholder="Customer name"
                        className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                      />
                      <input
                        value={marketplaceForm.customerPhone}
                        onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, customerPhone: e.target.value }))}
                        placeholder="Customer phone"
                        className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                      />
                    </div>
                    <input
                      value={marketplaceForm.customerEmail}
                      onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, customerEmail: e.target.value }))}
                      placeholder="Customer email (optional)"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                    />
                    <input
                      required
                      value={marketplaceForm.customerAddress}
                      onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, customerAddress: e.target.value }))}
                      placeholder="Delivery address"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                    />
                    <input
                      value={marketplaceForm.customerLandmark}
                      onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, customerLandmark: e.target.value }))}
                      placeholder="Landmark (optional)"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                    />

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase">Items</p>
                      {marketplaceItems.map((item, index) => (
                        <div key={`marketplace-item-${index}`} className="grid grid-cols-12 gap-2 items-center">
                          <select
                            value={item.menuItemId}
                            onChange={(e) => handleMarketplaceItemChange(index, 'menuItemId', e.target.value)}
                            className="col-span-7 border border-slate-200 rounded-xl px-3 py-2 text-sm"
                          >
                            <option value="">Select menu item</option>
                            {menuItems.map((menuItem) => (
                              <option key={menuItem.id} value={menuItem.id}>
                                {menuItem.name}
                              </option>
                            ))}
                          </select>
                          <input
                            value={item.quantity}
                            onChange={(e) => handleMarketplaceItemChange(index, 'quantity', e.target.value)}
                            placeholder="Qty"
                            className="col-span-2 border border-slate-200 rounded-xl px-2 py-2 text-sm text-center"
                          />
                          <input
                            value={item.notes}
                            onChange={(e) => handleMarketplaceItemChange(index, 'notes', e.target.value)}
                            placeholder="Notes"
                            className="col-span-2 border border-slate-200 rounded-xl px-2 py-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeMarketplaceItem(index)}
                            className="col-span-1 inline-flex items-center justify-center text-red-500"
                            title="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addMarketplaceItem}
                        className="inline-flex items-center gap-1 text-sm font-bold text-slate-700"
                      >
                        <CirclePlus className="h-4 w-4" /> Add item
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={marketplaceForm.paymentProvider}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({
                            ...prev,
                            paymentProvider: e.target.value as 'RAZORPAY' | 'PAYTM' | 'PHONEPE' | 'CASH',
                          }))
                        }
                        className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                      >
                        <option value="CASH">CASH</option>
                        <option value="RAZORPAY">RAZORPAY</option>
                        <option value="PAYTM">PAYTM</option>
                        <option value="PHONEPE">PHONEPE</option>
                      </select>
                      <select
                        value={marketplaceForm.paymentStatus}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({
                            ...prev,
                            paymentStatus: e.target.value as MarketplacePaymentStatus,
                          }))
                        }
                        className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                      >
                        {marketplacePaymentStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      value={marketplaceForm.specialInstructions}
                      onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, specialInstructions: e.target.value }))}
                      placeholder="Special instructions (optional)"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={syncingMarketplaceOrder}
                      className="w-full bg-slate-900 text-white rounded-xl py-2 text-sm font-bold disabled:opacity-60"
                    >
                      {syncingMarketplaceOrder ? 'Syncing...' : `Sync ${marketplaceForm.sourceSystem} Order`}
                    </button>
                  </form>

                  <div className="border border-slate-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="font-black text-slate-900">Imported Orders</h3>
                      <select
                        value={marketplaceFilter}
                        onChange={(e) => setMarketplaceFilter(e.target.value as MarketplacePlatformFilter)}
                        className="border border-slate-200 rounded-xl px-2 py-1.5 text-xs"
                      >
                        <option value="ALL">ALL</option>
                        {marketplacePlatforms.map((platform) => (
                          <option key={platform} value={platform}>
                            {platform}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2 max-h-[380px] overflow-auto pr-1">
                      {filteredMarketplaceOrders.slice(0, 24).map((order) => (
                        <div key={order.syncLogId} className="border border-slate-100 rounded-xl p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-slate-900">
                              {order.sourceSystem} #{order.externalOrderId || order.orderId.slice(0, 8).toUpperCase()}
                            </p>
                            <span className="text-[11px] font-semibold text-slate-600">{order.paymentStatus}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1">
                            {order.customerName || 'Guest'} | {formatInr(order.totalPaise)} | {order.itemsCount} items
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">{new Date(order.syncedAt).toLocaleString()}</p>
                        </div>
                      ))}
                      {filteredMarketplaceOrders.length === 0 && (
                        <p className="text-sm text-slate-500">No imported marketplace orders yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                <h3 className="font-black text-slate-900 mb-3">POS Sync Logs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-auto pr-1">
                  {syncLogs.slice(0, 20).map((log) => (
                    <div key={log.id} className="border border-slate-100 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-slate-900">{log.sourceSystem} - {log.eventType}</p>
                        <span className={`text-xs font-semibold ${log.status === 'SUCCESS' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {log.status}
                        </span>
                      </div>
                      {log.errorMessage && <p className="text-xs text-red-500 mt-1">{log.errorMessage}</p>}
                      <p className="text-[11px] text-slate-500 mt-1">{new Date(log.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                  {syncLogs.length === 0 && <p className="text-sm text-slate-500">No sync logs yet.</p>}
                </div>
                <div className="mt-4 rounded-xl bg-slate-100 p-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Clock3 className="h-4 w-4" />
                  Last refreshed {new Date().toLocaleTimeString()}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
