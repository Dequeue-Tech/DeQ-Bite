"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  apiClient,
  AnalyticsChatMessage,
  Category,
  DeliveryOrder,
  DeliveryRider,
  DeliveryStatus,
  MenuItem,
  Order,
  RestaurantUserEntry,
} from "@/lib/api-client";
import { useAuthStore } from "@/store/auth";
import {
  ChefHat,
  Plus,
  Trash2,
  CheckCircle,
  TrendingUp,
  Users,
  CreditCard,
  LayoutDashboard,
  BellRing,
  Clock,
  Check,
  X,
  Search,
  Activity,
  ChevronDown,
  Bike,
  MapPin,
  Phone,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Zap,
  RefreshCw,
  MessageSquare,
  Send,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatInr } from "@/lib/currency";
import {
  subscribeToOrderEvents,
  subscribeToRestaurantEvents,
} from "@/lib/realtime-client";
import {
  ensurePushSubscription,
  syncPushSubscriptionIfGranted,
} from "@/lib/push-notifications";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type MenuForm = {
  name: string;
  description: string;
  priceInr: string;
  categoryId: string;
};

type OrderChannelFilter = "ALL" | "DINE_IN" | "DELIVERY" | "ZOMATO" | "SWIGGY";

type RiderDraft = {
  riderId: string;
  branchId?: string;
};

type AdminOrderNotification = {
  id: string;
  orderId: string;
  title: string;
  subtitle: string;
  status: string;
  alertType?:
    | "new-order"
    | "accepted"
    | "status-update"
    | "payment-update"
    | "invoice";
  timestamp: number;
  unread: boolean;
};

const orderChannelFilters: Array<{ value: OrderChannelFilter; label: string }> =
  [
    { value: "ALL", label: "All Orders" },
    { value: "DINE_IN", label: "Dine-In" },
    { value: "DELIVERY", label: "Delivery" },
    { value: "ZOMATO", label: "Zomato" },
    { value: "SWIGGY", label: "Swiggy" },
  ];

const getStatusColor = (status: Order["status"]) => {
  const colors = {
    PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
    CONFIRMED: "bg-blue-100 text-blue-800 border-blue-200",
    PREPARING: "bg-purple-100 text-purple-800 border-purple-200",
    READY: "bg-orange-100 text-orange-800 border-orange-200",
    SERVED: "bg-teal-100 text-teal-800 border-teal-200",
    COMPLETED: "bg-green-100 text-green-800 border-green-200",
    CANCELLED: "bg-red-100 text-red-800 border-red-200",
  };
  return colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
};

const getDeliveryStatusColor = (status: DeliveryStatus) => {
  const colors = {
    PLACED: "bg-yellow-100 text-yellow-800 border-yellow-200",
    CONFIRMED: "bg-blue-100 text-blue-800 border-blue-200",
    PREPARING: "bg-purple-100 text-purple-800 border-purple-200",
    OUT_FOR_DELIVERY: "bg-orange-100 text-orange-800 border-orange-200",
    DELIVERED: "bg-green-100 text-green-800 border-green-200",
    CANCELLED: "bg-red-100 text-red-800 border-red-200",
  };
  return colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
};

const getPlainInstructions = (specialInstructions?: string) => {
  if (!specialInstructions) return "";
  const markerIndexes = [
    "[DELIVERY_META]",
    "[ORDER_CONTACT]",
    "[DELIVERY_EMAIL]",
  ]
    .map((marker) => specialInstructions.lastIndexOf(marker))
    .filter((idx) => idx >= 0);
  if (markerIndexes.length === 0) return specialInstructions.trim();
  const firstMarkerIndex = Math.min(...markerIndexes);
  return specialInstructions.slice(0, firstMarkerIndex).trim();
};

const getMarketplaceBadgeText = (
  order: Pick<Order, "sourceSystem" | "externalOrderId">,
) => {
  if (!order.sourceSystem) return null;
  if (!order.externalOrderId) return order.sourceSystem;
  return `${order.sourceSystem} #${order.externalOrderId}`;
};

const getOrderContextBadge = (
  order: Pick<
    Order,
    "isDelivery" | "sourceSystem" | "externalOrderId" | "table"
  >,
) => {
  const marketplace = getMarketplaceBadgeText(order);
  const isDeliveryOrder = Boolean(order.isDelivery || order.sourceSystem);

  if (isDeliveryOrder) {
    return {
      label: marketplace ? `Delivery - ${marketplace}` : "Delivery",
      className: "bg-blue-100 text-blue-700 border-blue-200",
    };
  }

  if (typeof order.table?.number === "number") {
    return {
      label: `Table ${order.table.number}`,
      className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    };
  }

  return {
    label: "Dine-In",
    className: "bg-gray-100 text-gray-700 border-gray-200",
  };
};

const toRelativeTime = (timestamp: number) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 8) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export default function AdminPage() {
  const router = useRouter();
  const { user, getProfile } = useAuthStore();
  const selectedRestaurantSlug = apiClient.getSelectedRestaurantSlug();
  const homeHref = selectedRestaurantSlug ? `/${selectedRestaurantSlug}` : "/";

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "menu" | "users" | "orders" | "delivery" | "payments"
  >("dashboard");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurantUsers, setRestaurantUsers] = useState<RestaurantUserEntry[]>(
    [],
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLimit] = useState(20);
  const [orderChannelFilter, setOrderChannelFilter] =
    useState<OrderChannelFilter>("ALL");
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
  const [saving, setSaving] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);

  const [confirmingCashOrderId, setConfirmingCashOrderId] = useState<
    string | null
  >(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [updatingDeliveryOrderId, setUpdatingDeliveryOrderId] = useState<
    string | null
  >(null);
  const [orderStatusDraft, setOrderStatusDraft] = useState<
    Record<string, Order["status"]>
  >({});
  const [paymentStatusDraft, setPaymentStatusDraft] = useState<
    Record<string, Order["paymentStatus"]>
  >({});
  const [paymentAmountDraft, setPaymentAmountDraft] = useState<
    Record<string, string>
  >({});
  const [deliveryStatusDraft, setDeliveryStatusDraft] = useState<
    Record<string, DeliveryStatus>
  >({});
  const [deliveryPaymentStatusDraft, setDeliveryPaymentStatusDraft] = useState<
    Record<string, Order["paymentStatus"]>
  >({});
  const [deliveryPaymentAmountDraft, setDeliveryPaymentAmountDraft] = useState<
    Record<string, string>
  >({});
  const [deliveryRiderDraft, setDeliveryRiderDraft] = useState<
    Record<string, RiderDraft>
  >({});
  const [deliverySearch, setDeliverySearch] = useState("");
  const [deliveryRiders, setDeliveryRiders] = useState<DeliveryRider[]>([]);
  const [deliveryRidersLoading, setDeliveryRidersLoading] = useState(false);
  const [riderBranchFilter, setRiderBranchFilter] = useState("");
  const [isAddRiderOpen, setIsAddRiderOpen] = useState(false);
  const [newRiderForm, setNewRiderForm] = useState({
    name: "",
    phone: "",
    vehicleType: "",
    branchId: "",
  });
  const [creatingRider, setCreatingRider] = useState(false);

  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<"OWNER" | "ADMIN" | "STAFF">(
    "STAFF",
  );
  const [paymentPolicy, setPaymentPolicy] = useState<{
    paymentCollectionTiming: "BEFORE_MEAL" | "AFTER_MEAL";
    cashPaymentEnabled: boolean;
  } | null>(null);
  const [menuForm, setMenuForm] = useState<MenuForm>({
    name: "",
    description: "",
    priceInr: "",
    categoryId: "",
  });
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [adminNotifications, setAdminNotifications] = useState<
    AdminOrderNotification[]
  >([]);
  const [expandedNotificationOrderId, setExpandedNotificationOrderId] =
    useState<string | null>(null);
  const [pulsingOrderIds, setPulsingOrderIds] = useState<
    Record<string, boolean>
  >({});
  const [adminSoundEnabled, setAdminSoundEnabled] = useState(true);
  const [adminPulseEnabled, setAdminPulseEnabled] = useState(true);
  const [adminAccessVerified, setAdminAccessVerified] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiInsights, setAiInsights] = useState<
    { type: string; title: string; desc: string }[] | null
  >(null);
  const [isCopilotChatOpen, setIsCopilotChatOpen] = useState(false);
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [isCopilotChatLoading, setIsCopilotChatLoading] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<
    AnalyticsChatMessage[]
  >([]);
  const [copilotSuggestedPrompts, setCopilotSuggestedPrompts] = useState<
    string[]
  >([
    "What should I push harder today?",
    "Where are we likely to lose orders?",
    "Give me one quick win for revenue.",
  ]);

  const generateRealTimeInsights = async () => {
    setIsGeneratingAi(true);
    setAiInsights(null); // Clear old insights

    try {
      const { topDishes, pendingDeliveries, totalOrders } =
        buildCopilotAnalyticsPayload();
      const payload = { topDishes, pendingDeliveries, totalOrders };

      const insights = await apiClient.generateInsights(payload);
      setAiInsights(insights);
    } catch (error: any) {
      toast.error(error?.message || "Could not generate insights right now.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const hasManagementAccess =
    user?.role === "OWNER" ||
    user?.role === "ADMIN" ||
    user?.restaurantRole === "OWNER" ||
    user?.restaurantRole === "ADMIN";
  const hasStaffOrderAccess =
    hasManagementAccess ||
    user?.role === "STAFF" ||
    user?.restaurantRole === "STAFF";
  const isStaffOnly = hasStaffOrderAccess && !hasManagementAccess;

  useEffect(() => {
    getProfile();
  }, [getProfile]);

  useEffect(() => {
    if (typeof user?.restaurantRole === "undefined") return;
    if (!hasStaffOrderAccess) {
      setAdminAccessVerified(false);
      router.replace(homeHref);
      return;
    }

    let isActive = true;
    setLoading(true);
    setAdminAccessVerified(false);

    (async () => {
      try {
        if (hasManagementAccess) {
          // owner/admin-only endpoint; confirms this user can see full admin console
          await apiClient.getRestaurantUsers();
        } else {
          setActiveTab("dashboard");
        }
        if (!isActive) return;
        setAdminAccessVerified(true);
        if (hasManagementAccess) {
          await loadBaseData();
        }
        if (!isActive) return;
        setOrdersPage(1);
        if (hasManagementAccess) {
          await Promise.all([
            loadOrdersPage(1, "ALL"),
            loadDeliveryOrders(),
            loadDeliveryRiders(),
          ]);
        } else {
          await loadOrdersPage(1, "ALL");
        }
      } catch {
        if (!isActive) return;
        setAdminAccessVerified(false);
        toast.error("Admin access denied for this account");
        router.replace(homeHref);
      } finally {
        if (!isActive) return;
        setLoading(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [
    user?.restaurantRole,
    hasStaffOrderAccess,
    hasManagementAccess,
    router,
    homeHref,
  ]);

  useEffect(() => {
    if (!isStaffOnly) return;
    if (activeTab !== "dashboard") {
      setActiveTab("dashboard");
    }
  }, [isStaffOnly, activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
    } else {
      setNotificationPermission(Notification.permission);
    }
    try {
      const stored = localStorage.getItem("admin_order_notifications");
      if (stored) {
        const parsed = JSON.parse(stored) as Array<any>;
        const normalized = parsed
          .map((entry) => ({
            id: String(entry.id || `${entry.orderId || "order"}-${Date.now()}`),
            orderId: String(entry.orderId || entry.id || ""),
            title: String(entry.title || entry.message || "Order Update"),
            subtitle: String(entry.subtitle || entry.message || ""),
            status: String(entry.status || "UPDATE"),
            alertType:
              entry.alertType === "new-order" ||
              entry.alertType === "accepted" ||
              entry.alertType === "status-update" ||
              entry.alertType === "payment-update" ||
              entry.alertType === "invoice"
                ? entry.alertType
                : undefined,
            timestamp: Number(entry.timestamp || Date.now()),
            unread: Boolean(entry.unread ?? false),
          }))
          .filter((entry) => entry.orderId);
        setAdminNotifications(normalized);
      }
      setAdminSoundEnabled(
        localStorage.getItem("admin_notification_sound") !== "off",
      );
      setAdminPulseEnabled(
        localStorage.getItem("admin_notification_haptics") !== "off",
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!hasStaffOrderAccess || typeof window === "undefined") return;
    const roleScope = hasManagementAccess ? "admin" : "staff";
    syncPushSubscriptionIfGranted(roleScope).catch(() => undefined);
  }, [hasStaffOrderAccess, hasManagementAccess]);

  useEffect(() => {
    if (!hasStaffOrderAccess || typeof window === "undefined") return;
    const restaurantSlug = apiClient.getActiveRestaurantSlug();
    const cleanup = subscribeToOrderEvents({
      restaurant: restaurantSlug,
      scope: "restaurant",
      role: hasManagementAccess ? "admin" : "staff",
      onEvent: (event) => {
        if (event?.type === "invoice.ready") {
          const orderId =
            (event?.payload?.orderId as string | undefined) ||
            (event?.payload?.order_id as string | undefined);
          if (!orderId) return;
          enqueueAdminNotifications([
            {
              id: `invoice-${orderId}-${Date.now()}`,
              orderId,
              title: `Order #${orderId.slice(0, 8).toUpperCase()} - Invoice Ready`,
              subtitle: "Invoice generated and ready to download",
              status: "INVOICE_READY",
              alertType: "invoice",
              timestamp: Date.now(),
              unread: true,
            },
          ]);
          return;
        }
        const order = event?.payload?.order;
        if (!order?.id) return;
        handleRealtimeOrderUpdate(order, event?.type, event?.eventId);
      },
      onReconnect: ({ lastSyncTimestamp }) => {
        if (!lastSyncTimestamp) return;
        loadOrdersDelta(lastSyncTimestamp).catch(() => undefined);
        if (!isStaffOnly) {
          loadDeliveryOrdersDelta(lastSyncTimestamp).catch(() => undefined);
        }
      },
    });

    return cleanup;
  }, [hasStaffOrderAccess, hasManagementAccess, isStaffOnly]);

  useEffect(() => {
    if (!hasManagementAccess || typeof window === "undefined") return;
    const restaurantSlug = apiClient.getActiveRestaurantSlug();
    const cleanup = subscribeToRestaurantEvents({
      restaurant: restaurantSlug,
      role: "admin",
      eventTypes: ["restaurant.users.updated", "rider.pool.updated"],
      onEvent: (event) => {
        if (event?.type === "rider.pool.updated") {
          const rider = event?.payload?.rider as DeliveryRider | undefined;
          if (!rider?.id) return;
          setDeliveryRiders((prev) => {
            const index = prev.findIndex((entry) => entry.id === rider.id);
            if (index === -1) return [rider, ...prev];
            const next = [...prev];
            next[index] = rider;
            return next;
          });
          return;
        }
        const membership = event?.payload?.membership as
          | RestaurantUserEntry
          | undefined;
        if (!membership?.membershipId || !membership.user?.id) return;
        upsertRestaurantUser(membership);
      },
    });

    return cleanup;
  }, [hasManagementAccess]);

  useEffect(() => {
    if (!hasStaffOrderAccess) return;
    loadOrdersPage(ordersPage, orderChannelFilter);
  }, [hasStaffOrderAccess, ordersPage, orderChannelFilter]);

  useEffect(() => {
    if (!hasStaffOrderAccess || isStaffOnly || activeTab !== "delivery") return;
    loadDeliveryOrders();
    loadDeliveryRiders(riderBranchFilter || undefined);
  }, [hasStaffOrderAccess, isStaffOnly, activeTab, riderBranchFilter]);

  const loadBaseData = async () => {
    try {
      setLoading(true);
      const [menuRes, categoriesRes, users, policy] = await Promise.all([
        apiClient.getAdminMenuItems(),
        apiClient.getCategories(),
        apiClient.getRestaurantUsers(),
        apiClient.getRestaurantPaymentPolicy(),
      ]);

      setMenuItems(menuRes.data || []);
      setCategories(categoriesRes.data || []);
      setRestaurantUsers(users);
      setPaymentPolicy(policy || null);

      if (!menuForm.categoryId && (categoriesRes.data || [])[0]) {
        setMenuForm((prev) => ({
          ...prev,
          categoryId: (categoriesRes.data || [])[0].id,
        }));
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  const loadOrdersPage = async (
    page: number,
    channel: OrderChannelFilter = orderChannelFilter,
  ) => {
    try {
      setOrdersLoading(true);
      const response = await apiClient.getRestaurantOrdersPage(
        page,
        ordersLimit,
        channel,
      );
      if (response.success) {
        setOrders(response.data || []);
        setOrdersTotal(response.pagination?.total || 0);
        setOrdersTotalPages(response.pagination?.totalPages || 1);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load orders");
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadDeliveryOrders = async () => {
    try {
      setDeliveryLoading(true);
      const response = await apiClient.getDeliveryOrders();
      if (response.success) {
        setDeliveryOrders(response.data || []);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load delivery orders");
    } finally {
      setDeliveryLoading(false);
    }
  };

  const loadOrdersDelta = async (updatedAfter: string) => {
    const response = await apiClient.getRestaurantOrders(
      orderChannelFilter,
      updatedAfter,
    );
    if (!response.success || !response.data?.length) return;
    response.data.forEach((order) => applyOrderUpdate(order));
  };

  const loadDeliveryOrdersDelta = async (updatedAfter: string) => {
    const response = await apiClient.getDeliveryOrders(updatedAfter);
    if (!response.success || !response.data?.length) return;
    response.data.forEach((order) => applyDeliveryUpdate(order));
  };

  const loadDeliveryRiders = async (branchId?: string) => {
    try {
      setDeliveryRidersLoading(true);
      const response = await apiClient.getDeliveryRiders(branchId);
      if (response.success) {
        setDeliveryRiders(response.data || []);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load riders");
    } finally {
      setDeliveryRidersLoading(false);
    }
  };

  const enqueueAdminNotifications = (newNotifs: AdminOrderNotification[]) => {
    if (!newNotifs.length) return;

    const playOrderTone = (variant: "new-order" | "default") => {
      if (typeof window === "undefined") return;
      try {
        const audioContext = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
        const scheduleTone = (
          frequency: number,
          startOffset: number,
          duration: number,
        ) => {
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = frequency;
          gain.gain.value = 0.055;
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          const startAt = audioContext.currentTime + startOffset;
          oscillator.start(startAt);
          oscillator.stop(startAt + duration);
        };

        if (variant === "new-order") {
          scheduleTone(1260, 0, 0.12);
          scheduleTone(920, 0.17, 0.16);
          return;
        }
        scheduleTone(880, 0, 0.12);
      } catch {
        // ignore audio errors
      }
    };

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      newNotifs.slice(0, 3).forEach((note) => {
        try {
          new Notification("Order Update", {
            body: `${note.title}${note.subtitle ? ` - ${note.subtitle}` : ""}`,
            tag: note.id,
          });
        } catch {
          // ignore notification errors
        }
      });
    }

    newNotifs.forEach((note) => toast(note.title));
    if (adminSoundEnabled) {
      const hasNewOrderAlert = newNotifs.some(
        (note) => note.alertType === "new-order",
      );
      playOrderTone(hasNewOrderAlert ? "new-order" : "default");
    }

    setAdminNotifications((prev) => {
      // Deduplicate by notification ID to prevent repeats
      const seen = new Set<string>();
      const merged = [...newNotifs, ...prev]
        .filter((note) => {
          if (seen.has(note.id)) return false;
          seen.add(note.id);
          return true;
        })
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 80);
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "admin_order_notifications",
          JSON.stringify(merged),
        );
      }
      return merged;
    });
  };

  const applyOrderUpdate = (incoming: Partial<Order> & { id: string }) => {
    let added = false;
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

      if (index === -1) {
        if (ordersPage !== 1) return prev;
        added = true;
        const next = [nextOrder, ...prev];
        return next.slice(0, ordersLimit);
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

  const upsertRestaurantUser = (incoming: RestaurantUserEntry) => {
    setRestaurantUsers((prev) => {
      if (!incoming.active) {
        return prev.filter(
          (entry) =>
            entry.membershipId !== incoming.membershipId &&
            entry.user.id !== incoming.user.id,
        );
      }
      const index = prev.findIndex(
        (entry) =>
          entry.membershipId === incoming.membershipId ||
          entry.user.id === incoming.user.id,
      );
      if (index === -1) {
        return [incoming, ...prev];
      }
      const next = [...prev];
      next[index] = {
        ...next[index],
        ...incoming,
        user: {
          ...next[index].user,
          ...incoming.user,
        },
      };
      return next;
    });
  };

  const handleRealtimeOrderUpdate = (
    incoming: Partial<Order> & { id: string },
    eventType?: string,
    eventId?: string,
  ) => {
    const notifications: AdminOrderNotification[] = [];
    let added = false;
    const isCreatedEvent = eventType === "order.created";
    const isAcceptedEvent = eventType === "order.accepted";

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

      if (isCreatedEvent) {
        notifications.push({
          id: eventId || `${incoming.id}-new-${Date.now()}`,
          orderId: incoming.id,
          title: `Order #${incoming.id.slice(0, 8).toUpperCase()} - Placed`,
          subtitle: "A new order has arrived and needs acceptance",
          status: incoming.status || "PENDING",
          alertType: "new-order",
          timestamp: Date.now(),
          unread: true,
        });
      } else if (isAcceptedEvent) {
        notifications.push({
          id: eventId || `${incoming.id}-accepted-${Date.now()}`,
          orderId: incoming.id,
          title: `Order #${incoming.id.slice(0, 8).toUpperCase()} - Accepted`,
          subtitle: "Order moved from Pending to Accepted",
          status: incoming.status || nextOrder.status || "CONFIRMED",
          alertType: "accepted",
          timestamp: Date.now(),
          unread: true,
        });
      } else if (!existing) {
        notifications.push({
          id: eventId || `${incoming.id}-new-${Date.now()}`,
          orderId: incoming.id,
          title: `Order #${incoming.id.slice(0, 8).toUpperCase()} - Updated`,
          subtitle: "An order was updated",
          status: incoming.status || "PENDING",
          alertType: "status-update",
          timestamp: Date.now(),
          unread: true,
        });
      } else {
        if (
          incoming.status &&
          incoming.status !== existing.status &&
          !isAcceptedEvent
        ) {
          notifications.push({
            id: `${incoming.id}-status-${Date.now()}`,
            orderId: incoming.id,
            title: `Order #${incoming.id.slice(0, 8).toUpperCase()} - ${incoming.status.replace(/_/g, " ")}`,
            subtitle: `Status changed from ${existing.status} to ${incoming.status}`,
            status: incoming.status,
            alertType: "status-update",
            timestamp: Date.now(),
            unread: true,
          });
        }
        if (
          incoming.paymentStatus &&
          incoming.paymentStatus !== existing.paymentStatus
        ) {
          notifications.push({
            id: `${incoming.id}-payment-${Date.now()}`,
            orderId: incoming.id,
            title: `Order #${incoming.id.slice(0, 8).toUpperCase()} - Payment ${incoming.paymentStatus}`,
            subtitle: `Payment status updated from ${existing.paymentStatus} to ${incoming.paymentStatus}`,
            status: incoming.paymentStatus,
            alertType: "payment-update",
            timestamp: Date.now(),
            unread: true,
          });
        }
      }

      if (index === -1) {
        added = true;
        if (ordersPage !== 1) return prev;
        const next = [nextOrder, ...prev];
        return next.slice(0, ordersLimit);
      }

      const next = [...prev];
      next[index] = nextOrder as Order;
      return next;
    });

    if (notifications.length) {
      enqueueAdminNotifications(notifications);
    }

    if (added) {
      if (adminPulseEnabled) {
        setPulsingOrderIds((prev) => ({ ...prev, [incoming.id]: true }));
        setTimeout(() => {
          setPulsingOrderIds((prev) => {
            const next = { ...prev };
            delete next[incoming.id];
            return next;
          });
        }, 1200);
      }
      setOrdersTotal((prev) => {
        const nextTotal = prev + 1;
        setOrdersTotalPages(Math.max(1, Math.ceil(nextTotal / ordersLimit)));
        return nextTotal;
      });
    }
  };

  const availableCount = useMemo(
    () => menuItems.filter((item) => item.available).length,
    [menuItems],
  );
  const pendingOrders = useMemo(
    () => orders.filter((order) => order.status === "PENDING"),
    [orders],
  );
  const activeOrders = useMemo(
    () =>
      orders.filter(
        (order) => !["COMPLETED", "CANCELLED"].includes(order.status),
      ),
    [orders],
  );
  const cashOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.paymentProvider === "CASH" &&
          o.paymentStatus !== "COMPLETED" &&
          o.status !== "CANCELLED",
      ),
    [orders],
  );
  const pendingDeliveryOrders = useMemo(
    () =>
      deliveryOrders.filter((o) =>
        ["PLACED", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY"].includes(
          o.deliveryMeta?.deliveryStatus || "",
        ),
      ),
    [deliveryOrders],
  );
  const filteredDeliveryOrders = useMemo(() => {
    const q = deliverySearch.trim().toLowerCase();
    if (!q) return deliveryOrders;
    return deliveryOrders.filter((order) => {
      const id = order.id.toLowerCase();
      const source = order.sourceSystem?.toLowerCase() || "";
      const externalOrderId = order.externalOrderId?.toLowerCase() || "";
      const name = order.deliveryMeta?.customerName?.toLowerCase() || "";
      const phone = order.deliveryMeta?.customerPhone?.toLowerCase() || "";
      const address = order.deliveryMeta?.deliveryAddress?.toLowerCase() || "";
      const rider = order.deliveryMeta?.riderName?.toLowerCase() || "";
      return (
        id.includes(q) ||
        source.includes(q) ||
        externalOrderId.includes(q) ||
        name.includes(q) ||
        phone.includes(q) ||
        address.includes(q) ||
        rider.includes(q)
      );
    });
  }, [deliveryOrders, deliverySearch]);

  const adminNotificationGroups = useMemo(() => {
    const grouped = new Map<
      string,
      {
        orderId: string;
        latest: AdminOrderNotification;
        history: AdminOrderNotification[];
        unread: boolean;
      }
    >();

    adminNotifications.forEach((note) => {
      const existing = grouped.get(note.orderId);
      if (!existing) {
        grouped.set(note.orderId, {
          orderId: note.orderId,
          latest: note,
          history: [note],
          unread: note.unread,
        });
        return;
      }
      existing.history.push(note);
      if (note.timestamp > existing.latest.timestamp) {
        existing.latest = note;
      }
      existing.unread = existing.unread || note.unread;
    });

    return Array.from(grouped.values())
      .sort((a, b) => b.latest.timestamp - a.latest.timestamp)
      .map((group) => ({
        ...group,
        history: group.history.sort((a, b) => b.timestamp - a.timestamp),
      }));
  }, [adminNotifications]);

  const ordersByStatus = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      },
      {} as Record<Order["status"], number>,
    );
  }, [orders]);

  const deliveryOrderIdSet = useMemo(
    () => new Set(deliveryOrders.map((order) => order.id)),
    [deliveryOrders],
  );
  const completedDineInOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.paymentStatus === "COMPLETED" &&
          !deliveryOrderIdSet.has(order.id),
      ),
    [orders, deliveryOrderIdSet],
  );
  const completedDeliveryOrders = useMemo(
    () =>
      deliveryOrders.filter(
        (order) =>
          order.paymentStatus === "COMPLETED" ||
          order.deliveryMeta.deliveryStatus === "DELIVERED",
      ),
    [deliveryOrders],
  );
  const dineInRevenuePaise = useMemo(
    () =>
      completedDineInOrders.reduce((sum, order) => sum + order.totalPaise, 0),
    [completedDineInOrders],
  );
  const deliveryRevenuePaise = useMemo(
    () =>
      completedDeliveryOrders.reduce((sum, order) => sum + order.totalPaise, 0),
    [completedDeliveryOrders],
  );
  const totalRevenuePaise = useMemo(
    () => dineInRevenuePaise + deliveryRevenuePaise,
    [dineInRevenuePaise, deliveryRevenuePaise],
  );
  const avgOrderValuePaise = useMemo(() => {
    const totalCompletedOrders =
      completedDineInOrders.length + completedDeliveryOrders.length;
    return totalCompletedOrders
      ? Math.round(totalRevenuePaise / totalCompletedOrders)
      : 0;
  }, [
    completedDineInOrders.length,
      completedDeliveryOrders.length,
      totalRevenuePaise,
  ]);
  const shouldAnimateDashboardKpis =
    activeTab === "dashboard" &&
    !isStaffOnly &&
    !loading &&
    adminAccessVerified;
  const kpiTargets = useMemo(
    () => ({
      totalRevenuePaise,
      deliveryRevenuePaise,
      ordersCount: orders.length,
      avgOrderValuePaise,
      pendingOrdersCount: pendingOrders.length,
    }),
    [
      totalRevenuePaise,
      deliveryRevenuePaise,
      orders.length,
      avgOrderValuePaise,
      pendingOrders.length,
    ],
  );
  const [animatedKpis, setAnimatedKpis] = useState({
    totalRevenuePaise: 0,
    deliveryRevenuePaise: 0,
    ordersCount: 0,
    avgOrderValuePaise: 0,
    pendingOrdersCount: 0,
  });
  const [hasPlayedKpiAnimation, setHasPlayedKpiAnimation] = useState(false);

  useEffect(() => {
    if (!shouldAnimateDashboardKpis) {
      setAnimatedKpis({
        totalRevenuePaise: 0,
        deliveryRevenuePaise: 0,
        ordersCount: 0,
        avgOrderValuePaise: 0,
        pendingOrdersCount: 0,
      });
      setHasPlayedKpiAnimation(false);
      return;
    }

    if (hasPlayedKpiAnimation) {
      setAnimatedKpis(kpiTargets);
      return;
    }

    const durationMs = 1200;
    const animationStart = performance.now();
    let frameId: number | null = null;

    const animate = (timestamp: number) => {
      const elapsed = timestamp - animationStart;
      const progress = Math.min(elapsed / durationMs, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      setAnimatedKpis({
        totalRevenuePaise: Math.round(kpiTargets.totalRevenuePaise * easedProgress),
        deliveryRevenuePaise: Math.round(
          kpiTargets.deliveryRevenuePaise * easedProgress,
        ),
        ordersCount: Math.round(kpiTargets.ordersCount * easedProgress),
        avgOrderValuePaise: Math.round(kpiTargets.avgOrderValuePaise * easedProgress),
        pendingOrdersCount: Math.round(
          kpiTargets.pendingOrdersCount * easedProgress,
        ),
      });

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        setAnimatedKpis(kpiTargets);
        setHasPlayedKpiAnimation(true);
      }
    };

    setAnimatedKpis({
      totalRevenuePaise: 0,
      deliveryRevenuePaise: 0,
      ordersCount: 0,
      avgOrderValuePaise: 0,
      pendingOrdersCount: 0,
    });
    frameId = requestAnimationFrame(animate);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [shouldAnimateDashboardKpis, hasPlayedKpiAnimation, kpiTargets]);

  const revenueText = formatInr(animatedKpis.totalRevenuePaise);
  const deliveryRevenueText = formatInr(animatedKpis.deliveryRevenuePaise);
  const avgOrderValueText = formatInr(animatedKpis.avgOrderValuePaise);

  const getFontSize = (text: string) => {
    if (text.length > 12) return "text-lg";
    if (text.length > 9) return "text-xl";
    return "text-3xl";
  };

  const salesByDay = useMemo(() => {
    const days: Array<{ label: string; value: number }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const label = date.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      });
      const total = [...completedDineInOrders, ...completedDeliveryOrders]
        .filter(
          (order) =>
            new Date(order.createdAt).toDateString() === date.toDateString(),
        )
        .reduce((sum, order) => sum + order.totalPaise, 0);
      days.push({ label, value: total });
    }
    return days;
  }, [completedDineInOrders, completedDeliveryOrders]);

  const topDishes = useMemo(() => {
    const map = new Map<
      string,
      { name: string; qty: number; revenue: number }
    >();
    [...completedDineInOrders, ...completedDeliveryOrders].forEach((order) => {
      order.items.forEach((item) => {
        const key = item.menuItem?.id || item.menuItemId;
        const entry = map.get(key) || {
          name: item.menuItem?.name || "Item",
          qty: 0,
          revenue: 0,
        };
        entry.qty += item.quantity;
        entry.revenue += item.pricePaise * item.quantity;
        map.set(key, entry);
      });
    });
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [completedDineInOrders, completedDeliveryOrders]);

  const statusMax = useMemo(
    () => Math.max(1, ...Object.values(ordersByStatus)),
    [ordersByStatus],
  );

  const buildCopilotAnalyticsPayload = () => ({
    topDishes:
      topDishes.length > 0
        ? topDishes.map((dish) => dish.name)
        : ["No data yet"],
    pendingDeliveries: pendingDeliveryOrders.length,
    totalOrders: ordersTotal,
    activeOrders: activeOrders.length,
    totalRevenuePaise,
    avgOrderValuePaise,
  });

  // --- Handlers ---

  // Dashboard Quick Action Handler
  const updateOrderStatus = async (
    orderId: string,
    status: Order["status"],
  ) => {
    try {
      setUpdatingOrderId(orderId);
      const expectedUpdatedAt = orders.find(
        (entry) => entry.id === orderId,
      )?.updatedAt;
      const response = await apiClient.updateOrderStatus(
        orderId,
        status,
        expectedUpdatedAt ? { expectedUpdatedAt } : undefined,
      );
      if (!response.success)
        throw new Error(response.error || "Failed to update order status");
      toast.success(`Order updated to ${status}`);
      if (response.data) {
        applyOrderUpdate(response.data);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to update order status");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleCopilotQuestionSubmit = async (questionOverride?: string) => {
    const question = (questionOverride ?? copilotQuestion).trim();
    if (!question || isCopilotChatLoading) return;

    const userMessage: AnalyticsChatMessage = {
      role: "user",
      content: question,
    };
    const nextMessages = [...copilotMessages, userMessage];

    setIsCopilotChatOpen(true);
    setCopilotMessages(nextMessages);
    setCopilotQuestion("");
    setIsCopilotChatLoading(true);

    try {
      const response = await apiClient.chatAnalytics({
        question,
        ...buildCopilotAnalyticsPayload(),
        messages: nextMessages.slice(-12),
      });

      setCopilotMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.reply },
      ]);
      if (response.suggestedPrompts.length > 0) {
        setCopilotSuggestedPrompts(response.suggestedPrompts);
      }
    } catch (error: any) {
      setCopilotMessages((prev) => prev.slice(0, -1));
      toast.error(
        error?.message || "Could not get deeper analytics insights right now.",
      );
    } finally {
      setIsCopilotChatLoading(false);
    }
  };

  // Unified Live Orders Update Handler
  const saveOrderChanges = async (order: Order) => {
    const newOrderStatus = orderStatusDraft[order.id] || order.status;
    const newPaymentStatus =
      paymentStatusDraft[order.id] || order.paymentStatus;
    const shouldUpdateStatus = newOrderStatus !== order.status;
    const shouldUpdatePayment = newPaymentStatus !== order.paymentStatus;

    if (shouldUpdatePayment && newPaymentStatus === "PARTIALLY_PAID") {
      const amountRaw = (paymentAmountDraft[order.id] || "").trim();
      if (!amountRaw) return toast.error("Enter a valid paid amount in INR");
      const amountInr = Number(amountRaw);
      if (!Number.isFinite(amountInr) || amountInr <= 0)
        return toast.error("Enter a valid paid amount in INR");
      const amountPaise = Math.round(amountInr * 100);
      if (amountPaise >= order.totalPaise)
        return toast.error("Paid amount must be less than order total");
    }

    if (!shouldUpdateStatus && !shouldUpdatePayment) {
      toast("No changes detected", { icon: "i" });
      return;
    }

    try {
      setUpdatingOrderId(order.id);
      let merged: Order = order;

      if (shouldUpdateStatus) {
        const statusResult = await apiClient.updateOrderStatus(
          order.id,
          newOrderStatus,
          {
            expectedUpdatedAt: merged.updatedAt,
          },
        );
        if (!statusResult.success || !statusResult.data) {
          throw new Error(
            statusResult.error || "Failed to update order status",
          );
        }
        merged = { ...merged, ...statusResult.data };
      }

      if (shouldUpdatePayment) {
        let paidAmountPaise: number | undefined;
        if (newPaymentStatus === "PARTIALLY_PAID") {
          const amountRaw = (paymentAmountDraft[order.id] || "").trim();
          paidAmountPaise = Math.round(Number(amountRaw) * 100);
        }
        const paymentResult = await apiClient.updatePaymentStatus({
          orderId: order.id,
          paymentStatus: newPaymentStatus,
          expectedUpdatedAt: merged.updatedAt,
          ...(newPaymentStatus === "PARTIALLY_PAID" ? { paidAmountPaise } : {}),
        });
        merged = { ...merged, ...paymentResult };
      }

      applyOrderUpdate(merged);
      toast.success("Order successfully updated");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update order");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const applyDeliveryUpdate = (incoming: DeliveryOrder) => {
    setDeliveryOrders((prev) => {
      const index = prev.findIndex((order) => order.id === incoming.id);
      if (index === -1) return [incoming, ...prev];
      const next = [...prev];
      next[index] = { ...next[index], ...incoming };
      return next;
    });
  };

  const saveDeliveryStatus = async (order: DeliveryOrder) => {
    const nextStatus =
      deliveryStatusDraft[order.id] || order.deliveryMeta.deliveryStatus;
    if (nextStatus === order.deliveryMeta.deliveryStatus) {
      toast("No delivery status changes", { icon: "i" });
      return;
    }

    try {
      setUpdatingDeliveryOrderId(order.id);
      const response = await apiClient.updateDeliveryOrderStatus(
        order.id,
        nextStatus,
        { expectedUpdatedAt: order.updatedAt },
      );
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to update delivery status");
      }
      applyDeliveryUpdate(response.data);
      toast.success(`Delivery marked as ${nextStatus}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update delivery status");
    } finally {
      setUpdatingDeliveryOrderId(null);
    }
  };

  const saveDeliveryPayment = async (order: DeliveryOrder) => {
    const nextPaymentStatus =
      deliveryPaymentStatusDraft[order.id] || order.paymentStatus;
    if (nextPaymentStatus === order.paymentStatus) {
      toast("No payment status changes", { icon: "i" });
      return;
    }

    let paidAmountPaise: number | undefined;
    if (nextPaymentStatus === "PARTIALLY_PAID") {
      const amountRaw = (deliveryPaymentAmountDraft[order.id] || "").trim();
      if (!amountRaw) return toast.error("Enter a valid paid amount in INR");
      const amountInr = Number(amountRaw);
      if (!Number.isFinite(amountInr) || amountInr <= 0)
        return toast.error("Enter a valid paid amount in INR");
      paidAmountPaise = Math.round(amountInr * 100);
      if (paidAmountPaise >= order.totalPaise)
        return toast.error("Paid amount must be less than order total");
    }

    try {
      setUpdatingDeliveryOrderId(order.id);
      const updatedOrder = await apiClient.updatePaymentStatus({
        orderId: order.id,
        paymentStatus: nextPaymentStatus,
        expectedUpdatedAt: order.updatedAt,
        ...(nextPaymentStatus === "PARTIALLY_PAID" ? { paidAmountPaise } : {}),
      });
      applyDeliveryUpdate(updatedOrder as DeliveryOrder);
      toast.success("Delivery payment status updated");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update delivery payment");
    } finally {
      setUpdatingDeliveryOrderId(null);
    }
  };

  const saveDeliveryRider = async (order: DeliveryOrder) => {
    const rider = deliveryRiderDraft[order.id];
    if (!rider?.riderId) {
      toast.error("Select a rider from this restaurant pool");
      return;
    }

    try {
      setUpdatingDeliveryOrderId(order.id);
      const response = await apiClient.assignDeliveryRider(
        order.id,
        {
          riderId: rider.riderId,
          ...(rider.branchId ? { branchId: rider.branchId } : {}),
        },
        { expectedUpdatedAt: order.updatedAt },
      );
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to assign rider");
      }
      applyDeliveryUpdate(response.data);
      toast.success("Rider assigned");
    } catch (error: any) {
      toast.error(error?.message || "Failed to assign rider");
    } finally {
      setUpdatingDeliveryOrderId(null);
    }
  };

  const createRiderInline = async () => {
    const name = newRiderForm.name.trim();
    const phone = newRiderForm.phone.trim();
    const vehicleType = newRiderForm.vehicleType.trim();
    if (!name || !phone || !vehicleType) {
      toast.error("Name, phone, and vehicle type are required");
      return;
    }

    try {
      setCreatingRider(true);
      const response = await apiClient.createDeliveryRider({
        name,
        phone,
        vehicleType,
        ...(newRiderForm.branchId.trim()
          ? { branchId: newRiderForm.branchId.trim() }
          : {}),
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to create rider");
      }
      toast.success("Rider added to this restaurant");
      setIsAddRiderOpen(false);
      setNewRiderForm({ name: "", phone: "", vehicleType: "", branchId: "" });
      await loadDeliveryRiders(riderBranchFilter || undefined);
    } catch (error: any) {
      toast.error(error?.message || "Failed to create rider");
    } finally {
      setCreatingRider(false);
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window))
      return toast.error("Browser notifications are not supported");
    try {
      await ensurePushSubscription(hasManagementAccess ? "admin" : "staff");
      setNotificationPermission("granted");
      toast.success("Admin notifications enabled");
    } catch (error: any) {
      const permission =
        typeof Notification !== "undefined"
          ? Notification.permission
          : "default";
      setNotificationPermission(permission as NotificationPermission);
      if (permission === "denied") toast.error("Notifications blocked.");
      else toast.error(error?.message || "Unable to enable notifications");
    }
  };

  const createMenuItem = async () => {
    if (!menuForm.name || !menuForm.priceInr || !menuForm.categoryId)
      return toast.error("Name, price, and category are required");
    const priceInr = Number(menuForm.priceInr);
    if (!Number.isFinite(priceInr) || priceInr <= 0)
      return toast.error("Price must be a valid positive number");

    try {
      setSaving(true);
      const response = await apiClient.createMenuItem({
        name: menuForm.name,
        description: menuForm.description || undefined,
        pricePaise: Math.round(priceInr * 100),
        categoryId: menuForm.categoryId,
      });
      if (response.success) {
        toast.success("Dish added to menu");
        setMenuForm((prev) => ({
          ...prev,
          name: "",
          description: "",
          priceInr: "",
        }));
        setIsMenuModalOpen(false);
        await loadBaseData();
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to create menu item");
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      await apiClient.updateMenuAvailability(item.id, !item.available);
      toast.success(
        `Dish marked as ${!item.available ? "available" : "unavailable"}`,
      );
      await loadBaseData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update availability");
    }
  };

  const removeDish = async (item: MenuItem) => {
    try {
      await apiClient.deleteMenuItem(item.id);
      toast.success(`${item.name} removed`);
      await loadBaseData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to remove dish");
    }
  };

  const addRestaurantUser = async () => {
    if (!userEmail) return toast.error("Enter a user email");
    try {
      const membership = await apiClient.addRestaurantUser({
        email: userEmail,
        role: userRole,
      });
      upsertRestaurantUser(membership);
      toast.success("Restaurant user updated");
      setUserEmail("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to add restaurant user");
    }
  };

  const savePaymentPolicy = async () => {
    if (!paymentPolicy) return;
    try {
      await apiClient.updateRestaurantPaymentPolicy(paymentPolicy);
      toast.success("Payment policy updated");
      await loadBaseData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save payment policy");
    }
  };

  const confirmCashPayment = async (orderId: string) => {
    try {
      setConfirmingCashOrderId(orderId);
      const expectedUpdatedAt = orders.find(
        (entry) => entry.id === orderId,
      )?.updatedAt;
      const order = await apiClient.confirmCashPayment(
        orderId,
        expectedUpdatedAt ? { expectedUpdatedAt } : undefined,
      );
      toast.success("Cash payment confirmed");
      if (order) {
        applyOrderUpdate(order);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to confirm cash payment");
    } finally {
      setConfirmingCashOrderId(null);
    }
  };

  if (typeof user?.restaurantRole === "undefined" || loading) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-medium text-sm">
            Loading Workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!hasStaffOrderAccess || !adminAccessVerified) return null;

  const tabs: Array<{
    id: "dashboard" | "orders" | "delivery" | "menu" | "users" | "payments";
    label: string;
    icon: any;
  }> = isStaffOnly
    ? [{ id: "dashboard", label: "Staff Dash", icon: LayoutDashboard }]
    : [
        { id: "dashboard", label: "Overview", icon: LayoutDashboard },
        { id: "orders", label: "Live Orders", icon: Activity },
        { id: "delivery", label: "Delivery", icon: Bike },
        { id: "menu", label: "Menu", icon: ChefHat },
        { id: "users", label: "Team", icon: Users },
        { id: "payments", label: "Settings", icon: CreditCard },
      ];

  // Render Form Component used for both Desktop Sidebar and Mobile Modal
  const renderDishForm = () => (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">
          Dish Name
        </label>
        <input
          value={menuForm.name}
          onChange={(e) => setMenuForm((p) => ({ ...p, name: e.target.value }))}
          className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500/20"
          placeholder="e.g. Truffle Fries"
        />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">
          Price (INR)
        </label>
        <input
          value={menuForm.priceInr}
          onChange={(e) =>
            setMenuForm((p) => ({ ...p, priceInr: e.target.value }))
          }
          className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500/20"
          placeholder="299"
          type="number"
        />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">
          Category
        </label>
        <div className="relative">
          <select
            value={menuForm.categoryId}
            onChange={(e) =>
              setMenuForm((p) => ({ ...p, categoryId: e.target.value }))
            }
            className="w-full bg-gray-50 border-none rounded-xl pl-4 pr-10 py-3 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 appearance-none"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">
          Description
        </label>
        <textarea
          value={menuForm.description}
          onChange={(e) =>
            setMenuForm((p) => ({ ...p, description: e.target.value }))
          }
          rows={3}
          className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500/20"
          placeholder="Short description..."
        />
      </div>
      <button
        onClick={createMenuItem}
        disabled={saving}
        className="w-full bg-orange-600 text-white py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold hover:bg-orange-700 transition-transform active:scale-95 mt-2 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Publish Dish"}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 relative">
      {/* Header Area */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2 sm:p-2.5 rounded-xl text-white shadow-lg shadow-orange-500/20">
                  <ChefHat className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-none">
                    {isStaffOnly ? "Staff Console" : "Admin Console"}
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    @{selectedRestaurantSlug}
                  </p>
                </div>
              </div>
              {/* Mobile Bell Icon */}
              {notificationPermission !== "granted" ? (
                <button
                  onClick={requestNotificationPermission}
                  className="sm:hidden p-2 text-orange-600 bg-orange-50 rounded-xl"
                  title="Enable notifications"
                >
                  <BellRing className="h-5 w-5" />
                </button>
              ) : (
                <div
                  className="sm:hidden p-2 text-green-700 bg-green-50 rounded-xl"
                  title="Notifications enabled"
                >
                  <BellRing className="h-5 w-5" />
                </div>
              )}
            </div>

            {/* Desktop Bell Button */}
            <button
              onClick={
                notificationPermission === "granted"
                  ? undefined
                  : requestNotificationPermission
              }
              className={`hidden sm:flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors ${
                notificationPermission === "granted"
                  ? "text-green-700 bg-green-50 cursor-default"
                  : notificationPermission === "denied"
                    ? "text-red-700 bg-red-50 hover:bg-red-100"
                    : "text-orange-600 bg-orange-50 hover:bg-orange-100"
              }`}
            >
              <BellRing className="h-4 w-4" />
              {notificationPermission === "granted"
                ? "Alerts Enabled"
                : notificationPermission === "denied"
                  ? "Alerts Blocked"
                  : "Enable Alerts"}
            </button>
          </div>

          {/* Edge-to-Edge Scrollable Pill Navigation on Mobile */}
          <div className="relative mt-5 sm:mt-6">
            <div
              className="flex overflow-x-auto gap-2 p-1 bg-gray-100/60 rounded-xl sm:rounded-2xl w-full border border-gray-100 -mx-4 px-4 sm:mx-0 sm:px-1 sm:w-max no-scrollbar"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg sm:rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab.id
                        ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/50"
                        : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    {tab.id === "orders" && pendingOrders.length > 0 && (
                      <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-1">
                        {pendingOrders.length}
                      </span>
                    )}
                    {tab.id === "delivery" &&
                      pendingDeliveryOrders.length > 0 && (
                        <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-1">
                          {pendingDeliveryOrders.length}
                        </span>
                      )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {/* STAFF DASHBOARD TAB */}
        {activeTab === "dashboard" && isStaffOnly && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-gray-900">
                    Staff Dashboard
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Take actions on incoming orders in real time.
                  </p>
                </div>
                {notificationPermission !== "granted" && (
                  <button
                    onClick={requestNotificationPermission}
                    className="inline-flex items-center justify-center gap-2 text-sm font-bold text-orange-700 bg-orange-50 px-4 py-2.5 rounded-xl hover:bg-orange-100 transition-colors"
                  >
                    <BellRing className="h-4 w-4" />
                    Enable Notifications
                  </button>
                )}
              </div>

              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
                Take Actions
              </h3>

              {pendingOrders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
                  <p className="text-sm font-semibold text-gray-500">
                    No pending orders right now.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-gray-50 rounded-2xl p-4 border border-gray-100"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="font-black text-gray-900">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {order.user?.name || "Guest"} •{" "}
                            {formatInr(order.totalPaise)}
                          </p>
                          <span
                            className={`inline-flex mt-2 text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${getStatusColor(order.status)}`}
                          >
                            {order.status}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              updateOrderStatus(order.id, "CONFIRMED")
                            }
                            disabled={updatingOrderId === order.id}
                            className="text-xs font-bold px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-black disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() =>
                              updateOrderStatus(order.id, "CANCELLED")
                            }
                            disabled={updatingOrderId === order.id}
                            className="text-xs font-bold px-4 py-2 rounded-xl bg-white text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DASHBOARD TAB */}
        {activeTab === "dashboard" && !isStaffOnly && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                <p className="text-xs sm:text-sm font-bold text-gray-500 flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />{" "}
                  Total Revenue
                </p>
                <p
                  className={`${getFontSize(revenueText)} font-black text-gray-900 mt-1 sm:mt-2`}
                >
                  {revenueText}
                </p>
              </div>

              <div className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                <p className="text-xs sm:text-sm font-bold text-gray-500 flex items-center gap-1.5">
                  <Bike className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />{" "}
                  Delivery Revenue
                </p>
                <p
                  className={`${getFontSize(deliveryRevenueText)} font-black text-gray-900 mt-1 sm:mt-2`}
                >
                  {deliveryRevenueText}
                </p>
              </div>

              <div className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                <p className="text-xs sm:text-sm font-bold text-gray-500 flex items-center gap-1.5">
                  <LayoutDashboard className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />{" "}
                  Orders
                </p>
                <p className="text-xl sm:text-3xl font-black text-gray-900 mt-1 sm:mt-2">
                  {animatedKpis.ordersCount}
                </p>
              </div>

              <div className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                <p className="text-xs sm:text-sm font-bold text-gray-500 flex items-center gap-1.5">
                  <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" />{" "}
                  Avg Order
                </p>
                <p
                  className={`${getFontSize(avgOrderValueText)} font-black text-gray-900 mt-1 sm:mt-2`}
                >
                  {avgOrderValueText}
                </p>
              </div>

              <div className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                <p className="text-xs sm:text-sm font-bold text-gray-500 flex items-center gap-1.5">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500" />{" "}
                  Action
                </p>
                <p className="text-xl sm:text-3xl font-black text-gray-900 mt-1 sm:mt-2">
                  {animatedKpis.pendingOrdersCount}
                </p>
              </div>
            </div>

            {/* --- AI COPILOT SECTION --- */}
            <div className="relative bg-gradient-to-br from-orange-50/50 via-white to-blue-50/30 rounded-[32px] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-orange-100/50 overflow-hidden mt-2 group">
              {/* Subtle animated background mesh */}
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-orange-400/10 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-700 pointer-events-none translate-x-1/3 -translate-y-1/3" />

              <div className="relative z-10 flex flex-col lg:flex-row gap-8">
                {/* Left: AI Header & CTA */}
                <div className="lg:w-1/3 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-gray-200/60 pb-6 lg:pb-0 lg:pr-8">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2 rounded-xl shadow-md shadow-orange-500/20 text-white">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <h2 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight">
                      Bite Copilot
                    </h2>
                  </div>
                  <p className="text-gray-500 text-sm font-medium leading-relaxed mb-6">
                    Analyze your live kitchen traffic, delivery load, and sales
                    data to uncover hidden growth opportunities.
                  </p>
                  <button
                    onClick={generateRealTimeInsights}
                    disabled={isGeneratingAi}
                    className="w-max flex items-center gap-2 text-sm font-bold text-white bg-gray-900 px-6 py-3 rounded-xl hover:bg-black active:scale-95 transition-all shadow-lg disabled:opacity-70 disabled:active:scale-100"
                  >
                    {isGeneratingAi ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Analyzing
                        Data...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 text-orange-400" /> Generate
                        Insights
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setIsCopilotChatOpen((prev) => !prev)}
                    className="mt-3 w-max flex items-center gap-2 text-sm font-bold text-gray-700 bg-white/90 px-5 py-3 rounded-xl border border-gray-200 hover:border-orange-200 hover:text-gray-900 hover:bg-white transition-all shadow-sm"
                  >
                    <MessageSquare className="h-4 w-4 text-orange-500" />
                    Chat For More Insights
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-300 ${isCopilotChatOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>

                {/* Right: Dynamic Insights Feed */}
                <div className="lg:w-2/3 flex flex-col justify-center">
                  {/* Empty State (Before clicking generate) */}
                  {!isGeneratingAi && !aiInsights && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-6 opacity-60">
                      <Sparkles className="h-8 w-8 text-gray-300 mb-3" />
                      <p className="text-sm font-bold text-gray-400">
                        Ready to analyze your restaurant's performance.
                      </p>
                    </div>
                  )}

                  {/* Loading Skeleton (While generating) */}
                  {isGeneratingAi && (
                    <div className="space-y-4 animate-pulse">
                      <div className="bg-white/60 backdrop-blur-sm border border-gray-100 rounded-2xl p-5 w-full h-24 rounded-xl" />
                      <div className="bg-white/60 backdrop-blur-sm border border-gray-100 rounded-2xl p-5 w-full h-24 rounded-xl" />
                    </div>
                  )}

                  {/* Rendered Insights */}
                  {!isGeneratingAi && aiInsights && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {aiInsights.map((insight, idx) => (
                        <div
                          key={idx}
                          className="bg-white/80 backdrop-blur-md border border-white shadow-sm rounded-2xl p-5 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {insight.type === "growth" ? (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            )}
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                              {insight.title}
                            </h3>
                          </div>
                          <p className="text-sm font-bold text-gray-800 leading-relaxed mt-2">
                            {insight.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div
                className={`relative z-10 overflow-hidden transition-all duration-500 ease-out ${isCopilotChatOpen ? "max-h-[720px] opacity-100 mt-6 pt-6 border-t border-gray-200/70" : "max-h-0 opacity-0 mt-0 pt-0 border-t border-transparent"}`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.65fr] gap-4">
                  <div className="rounded-[28px] border border-gray-200/70 bg-white/85 backdrop-blur-sm shadow-sm">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <div>
                        <h3 className="text-sm font-black text-gray-900 tracking-tight">
                          Bite Copilot Chat
                        </h3>
                        <p className="text-xs font-medium text-gray-500 mt-1">
                          Ask follow-up questions about today&apos;s live
                          restaurant metrics.
                        </p>
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-500">
                        Live
                      </div>
                    </div>

                    <div className="max-h-[360px] overflow-y-auto px-5 py-4 space-y-3">
                      {copilotMessages.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 px-4 py-4 text-sm text-gray-600">
                          Ask Bite Copilot about menu momentum, delivery
                          slowdowns, pricing opportunities, or what to push next
                          based on your current numbers.
                        </div>
                      )}

                      {copilotMessages.map((message, index) => (
                        <div
                          key={`${message.role}-${index}`}
                          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm font-medium leading-relaxed shadow-sm ${
                              message.role === "user"
                                ? "bg-gray-900 text-white"
                                : "bg-white border border-gray-200 text-gray-800"
                            }`}
                          >
                            {message.content}
                          </div>
                        </div>
                      ))}

                      {isCopilotChatLoading && (
                        <div className="flex justify-start">
                          <div className="rounded-2xl px-4 py-3 text-sm font-medium leading-relaxed shadow-sm bg-white border border-gray-200 text-gray-500 flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
                            Bite Copilot is thinking...
                          </div>
                        </div>
                      )}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleCopilotQuestionSubmit();
                      }}
                      className="border-t border-gray-100 px-5 py-4"
                    >
                      <div className="flex flex-col sm:flex-row gap-3">
                        <textarea
                          value={copilotQuestion}
                          onChange={(e) => setCopilotQuestion(e.target.value)}
                          placeholder="Ask about demand, delivery pressure, pricing, repeat orders, or your next best move..."
                          rows={2}
                          className="flex-1 resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 outline-none transition-colors focus:border-orange-300"
                        />
                        <button
                          type="submit"
                          disabled={
                            isCopilotChatLoading || !copilotQuestion.trim()
                          }
                          className="sm:self-end inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-900 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Send className="h-4 w-4" />
                          Ask AI
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="rounded-[28px] border border-gray-200/70 bg-white/75 backdrop-blur-sm p-5 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">
                      Suggested Prompts
                    </p>
                    <div className="mt-4 space-y-3">
                      {copilotSuggestedPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() =>
                            void handleCopilotQuestionSubmit(prompt)
                          }
                          disabled={isCopilotChatLoading}
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-bold text-gray-700 transition-all hover:border-orange-200 hover:bg-orange-50 hover:text-gray-900 disabled:opacity-60"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                    <div className="mt-5 rounded-2xl bg-gray-50 px-4 py-4 text-xs font-medium leading-relaxed text-gray-500">
                      Bite Copilot uses the same live dashboard context shown
                      above, including top dishes, active orders, delivery load,
                      revenue, and average order value.
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* ------------------------------------------ */}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100">
                <div className="mb-4">
                  <h2 className="text-lg sm:text-xl font-black text-gray-900">
                    Revenue Flow
                  </h2>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">
                    Last 7 days performance
                  </p>
                </div>

                <div className="h-48 sm:h-64 mt-4 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={salesByDay}
                      margin={{ top: 10, right: 0, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f3f4f6"
                      />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fill: "#9ca3af",
                          fontWeight: 600,
                        }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fill: "#9ca3af",
                          fontWeight: 600,
                        }}
                        tickFormatter={(value) => `₹${value / 100}`}
                      />
                      <Tooltip
                        cursor={{ fill: "#fff7ed" }}
                        content={({ active, payload }) =>
                          active && payload && payload.length ? (
                            <div className="bg-gray-900 text-white text-xs font-bold py-2 px-3 rounded-lg shadow-xl">
                              {formatInr(payload[0].value as number)}
                            </div>
                          ) : null
                        }
                      />
                      <Bar
                        dataKey="value"
                        fill="#ea580c"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-5 sm:mb-6">
                  Pipeline
                </h2>
                <div className="space-y-4">
                  {(
                    [
                      "PENDING",
                      "PREPARING",
                      "READY",
                      "COMPLETED",
                    ] as Order["status"][]
                  ).map((status) => {
                    const count = ordersByStatus[status] || 0;
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-500 w-20">
                          {status}
                        </span>
                        <div className="flex-1 h-2 sm:h-3 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${status === "COMPLETED" ? "bg-green-500" : "bg-orange-500"}`}
                            style={{
                              width: `${Math.max(5, Math.round((count / statusMax) * 100))}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs sm:text-sm font-black text-gray-900 w-6 text-right">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
                  <ChefHat className="h-5 w-5 text-orange-500" /> Top Dishes
                </h2>
                {topDishes.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Not enough data yet.
                  </p>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {topDishes.map((dish, idx) => (
                      <div
                        key={`${dish.name}-${idx}`}
                        className="flex items-center justify-between p-2 sm:p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-4">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 rounded-full bg-orange-100 text-orange-600 font-black flex items-center justify-center text-xs">
                            #{idx + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-xs sm:text-sm truncate">
                              {dish.name}
                            </p>
                            <p className="text-[10px] sm:text-xs font-medium text-gray-500">
                              {dish.qty} servings
                            </p>
                          </div>
                        </div>
                        <span className="font-black text-gray-900 text-xs sm:text-sm shrink-0">
                          {formatInr(dish.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
                  <BellRing className="h-5 w-5 text-orange-500" /> Action
                  Required
                </h2>
                {pendingOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 text-green-400 mx-auto mb-2 sm:mb-3" />
                    <p className="text-xs sm:text-sm font-bold text-gray-500">
                      All caught up!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingOrders.slice(0, 4).map((order) => (
                      <div
                        key={order.id}
                        className="bg-gray-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-gray-100"
                      >
                        <div>
                          <p className="font-black text-gray-900 text-sm sm:text-base">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-[10px] sm:text-xs font-medium text-gray-500 mt-0.5">
                            {order.user?.name || "Guest"} •{" "}
                            {formatInr(order.totalPaise)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              updateOrderStatus(order.id, "CONFIRMED")
                            }
                            disabled={updatingOrderId === order.id}
                            className="flex-1 sm:flex-none text-xs font-bold px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-gray-900 text-white hover:bg-black transition-colors disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() =>
                              updateOrderStatus(order.id, "CANCELLED")
                            }
                            disabled={updatingOrderId === order.id}
                            className="flex-1 sm:flex-none text-xs font-bold px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ORDERS TAB - Modern Grid Layout */}
        {activeTab === "orders" && !isStaffOnly && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-lg sm:text-xl font-black text-gray-900">
                  Live Orders
                </h2>
                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search ID..."
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <select
                    value={orderChannelFilter}
                    onChange={(e) => {
                      const nextFilter = e.target.value as OrderChannelFilter;
                      setOrderChannelFilter(nextFilter);
                      setOrdersPage(1);
                    }}
                    className="bg-gray-50 border-none rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-gray-700 focus:ring-2 focus:ring-orange-500/20"
                  >
                    {orderChannelFilters.map((filter) => (
                      <option key={filter.value} value={filter.value}>
                        {filter.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {notificationPermission !== "granted" && (
                <div className="mb-5 bg-orange-50 border border-orange-100 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xs sm:text-sm font-semibold text-orange-900">
                    Enable browser notifications for instant order alerts.
                  </p>
                  <button
                    onClick={requestNotificationPermission}
                    className="inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-white bg-orange-600 px-4 py-2 rounded-lg hover:bg-orange-700"
                  >
                    <BellRing className="h-4 w-4" />
                    Enable Notifications
                  </button>
                </div>
              )}

              {isStaffOnly && pendingOrders.length > 0 && (
                <div className="mb-5 bg-gray-50 border border-gray-100 rounded-xl p-3 sm:p-4">
                  <p className="text-xs sm:text-sm font-semibold text-gray-900 mb-3">
                    Pending Orders - Quick Actions
                  </p>
                  <div className="space-y-2">
                    {pendingOrders.slice(0, 5).map((order) => (
                      <div
                        key={`pending-${order.id}`}
                        className="flex items-center justify-between gap-3 bg-white border border-gray-100 rounded-lg p-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-black text-gray-900">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {order.user?.name || "Guest"} -{" "}
                            {formatInr(order.totalPaise)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() =>
                              updateOrderStatus(order.id, "CONFIRMED")
                            }
                            disabled={updatingOrderId === order.id}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-black disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() =>
                              updateOrderStatus(order.id, "CANCELLED")
                            }
                            disabled={updatingOrderId === order.id}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <p className="text-xs sm:text-sm text-gray-500 font-medium">
                  Page {ordersPage} of {ordersTotalPages} - {ordersTotal} orders
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setOrdersPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={ordersPage <= 1 || ordersLoading}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() =>
                      setOrdersPage((prev) =>
                        Math.min(ordersTotalPages, prev + 1),
                      )
                    }
                    disabled={ordersPage >= ordersTotalPages || ordersLoading}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>

              {adminNotificationGroups.length > 0 && (
                <div className="mb-5 bg-white rounded-2xl border border-gray-200 p-0 shadow-sm overflow-hidden">
                  <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                    {/* <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const next = !adminSoundEnabled;
                          setAdminSoundEnabled(next);
                          localStorage.setItem('admin_notification_sound', next ? 'on' : 'off');
                        }}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                          adminSoundEnabled ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        Sound
                      </button>
                      <button
                        onClick={() => {
                          const next = !adminPulseEnabled;
                          setAdminPulseEnabled(next);
                          localStorage.setItem('admin_notification_haptics', next ? 'on' : 'off');
                        }}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                          adminPulseEnabled ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        Haptics
                      </button>
                    </div> */}
                    <button
                      onClick={() => {
                        setAdminNotifications([]);
                        localStorage.setItem(
                          "admin_order_notifications",
                          JSON.stringify([]),
                        );
                      }}
                      className="text-[11px] font-semibold text-gray-600 hover:text-gray-900"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto thin-scrollbar px-3 py-3 space-y-2">
                    {adminNotificationGroups.map((group) => {
                      const status = group.latest.status.toUpperCase();
                      const accentClass =
                        status.includes("CANCEL") || status.includes("FAILED")
                          ? "border-l-red-500"
                          : status.includes("DELIVER")
                            ? "border-l-green-500"
                            : status.includes("OUT_FOR_DELIVERY")
                              ? "border-l-orange-500"
                              : status.includes("PREPAR")
                                ? "border-l-blue-500"
                                : "border-l-yellow-500";
                      return (
                        <div
                          key={group.orderId}
                          className={`border border-gray-200 border-l-4 ${accentClass} rounded-xl p-3 transition-colors ${
                            group.unread ? "bg-orange-50/40" : "bg-white"
                          }`}
                        >
                          <button
                            className="w-full flex items-start justify-between gap-2 text-left"
                            onClick={() => {
                              setExpandedNotificationOrderId((prev) =>
                                prev === group.orderId ? null : group.orderId,
                              );
                              setAdminNotifications((prev) => {
                                const next = prev.map((note) =>
                                  note.orderId === group.orderId
                                    ? { ...note, unread: false }
                                    : note,
                                );
                                localStorage.setItem(
                                  "admin_order_notifications",
                                  JSON.stringify(next),
                                );
                                return next;
                              });
                            }}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-black text-gray-900 truncate">
                                {group.latest.title}
                              </p>
                              {/* <p className="text-xs text-gray-500 truncate">{group.latest.subtitle}</p> */}
                            </div>
                            <span className="text-[10px] font-semibold text-gray-400 whitespace-nowrap">
                              {toRelativeTime(group.latest.timestamp)}
                            </span>
                          </button>
                          {expandedNotificationOrderId === group.orderId && (
                            <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                              {group.history.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="flex items-center justify-between gap-2 text-xs text-gray-600"
                                >
                                  <span className="truncate">
                                    {entry.subtitle}
                                  </span>
                                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                    {toRelativeTime(entry.timestamp)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {ordersLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={`order-skeleton-${idx}`}
                      className="bg-white border border-gray-100 rounded-2xl sm:rounded-[28px] p-4 sm:p-5"
                    >
                      <div className="animate-pulse space-y-3">
                        <div className="h-4 w-1/3 rounded bg-gray-200" />
                        <div className="h-12 rounded-2xl bg-gray-100" />
                        <div className="h-20 rounded-2xl bg-gray-100" />
                        <div className="h-10 rounded-xl bg-gray-200" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className={`bg-white border border-gray-100 rounded-2xl sm:rounded-[28px] p-4 sm:p-5 hover:border-orange-200 transition-all flex flex-col h-full shadow-[0_4px_20px_rgb(0,0,0,0.03)] group ${
                        pulsingOrderIds[order.id] ? "staff-order-pulse" : ""
                      }`}
                    >
                      {(() => {
                        const contextBadge = getOrderContextBadge(order);
                        return (
                          <div className="mb-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[10px] font-black uppercase tracking-wider ${contextBadge.className}`}
                            >
                              {contextBadge.label}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Order Info (Top) */}
                      <div className="flex-1 flex flex-col">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="font-black text-lg text-gray-900 leading-tight">
                              #{order.id.slice(0, 8).toUpperCase()}
                            </p>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                              {order.user?.name || "Walk-in"} •{" "}
                              {formatInr(order.totalPaise)}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${getStatusColor(order.status)}`}
                          >
                            {order.status}
                          </span>
                        </div>

                        {/* 2x2 Info Grid */}
                        <div className="mt-4 grid grid-cols-2 gap-3 bg-gray-50 rounded-2xl p-4 border border-gray-100 mb-5">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">
                              Payment
                            </p>
                            <p className="text-xs font-black text-gray-900 truncate">
                              {order.paymentStatus}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">
                              Method
                            </p>
                            <p className="text-xs font-black text-gray-900 truncate">
                              {order.paymentProvider || "NA"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">
                              Paid
                            </p>
                            <p className="text-xs font-black text-green-600 truncate">
                              {formatInr(order.paidAmountPaise || 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">
                              Due
                            </p>
                            <p className="text-xs font-black text-orange-600 truncate">
                              {formatInr(order.dueAmountPaise || 0)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Unified Update Controls (Bottom Pushed) */}
                      <div className="w-full mt-auto bg-gray-50 rounded-[20px] p-4 border border-gray-100 group-hover:bg-white group-hover:border-orange-100 transition-colors">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                          Update Order
                        </p>
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                              Kitchen Status
                            </label>
                            <div className="relative">
                              <select
                                value={
                                  orderStatusDraft[order.id] || order.status
                                }
                                onChange={(e) =>
                                  setOrderStatusDraft((p) => ({
                                    ...p,
                                    [order.id]: e.target
                                      .value as Order["status"],
                                  }))
                                }
                                className="w-full bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2.5 text-xs font-bold focus:ring-2 focus:ring-orange-500/20 appearance-none"
                              >
                                {(
                                  [
                                    "PENDING",
                                    "CONFIRMED",
                                    "PREPARING",
                                    "READY",
                                    "SERVED",
                                    "COMPLETED",
                                    "CANCELLED",
                                  ] as Order["status"][]
                                ).map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                              Payment Status
                            </label>
                            <div className="relative">
                              <select
                                value={
                                  paymentStatusDraft[order.id] ||
                                  order.paymentStatus
                                }
                                onChange={(e) =>
                                  setPaymentStatusDraft((p) => ({
                                    ...p,
                                    [order.id]: e.target
                                      .value as Order["paymentStatus"],
                                  }))
                                }
                                className="w-full bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2.5 text-xs font-bold focus:ring-2 focus:ring-orange-500/20 appearance-none"
                              >
                                {(
                                  [
                                    "PENDING",
                                    "PROCESSING",
                                    "COMPLETED",
                                    "FAILED",
                                    "REFUNDED",
                                    "PARTIALLY_PAID",
                                  ] as Order["paymentStatus"][]
                                ).map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                            </div>
                          </div>

                          {(paymentStatusDraft[order.id] ||
                            order.paymentStatus) === "PARTIALLY_PAID" && (
                            <input
                              value={paymentAmountDraft[order.id] || ""}
                              onChange={(e) =>
                                setPaymentAmountDraft((p) => ({
                                  ...p,
                                  [order.id]: e.target.value,
                                }))
                              }
                              placeholder="Paid Amount ₹"
                              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-orange-500/20"
                            />
                          )}

                          <button
                            onClick={() => saveOrderChanges(order)}
                            disabled={updatingOrderId === order.id}
                            className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-xs font-bold hover:bg-black transition-all active:scale-95 disabled:opacity-50 mt-1 shadow-sm"
                          >
                            {updatingOrderId === order.id
                              ? "Saving..."
                              : "Save Changes"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DELIVERY TAB - Modern Grid Layout */}
        {activeTab === "delivery" && !isStaffOnly && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 shadow-sm border border-gray-100">
                <p className="text-xs sm:text-sm font-bold text-gray-500">
                  Total Delivery Orders
                </p>
                <p className="text-xl sm:text-3xl font-black text-gray-900 mt-1 sm:mt-2">
                  {deliveryOrders.length}
                </p>
              </div>
              <div className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 shadow-sm border border-gray-100">
                <p className="text-xs sm:text-sm font-bold text-gray-500">
                  Active Delivery
                </p>
                <p className="text-xl sm:text-3xl font-black text-gray-900 mt-1 sm:mt-2">
                  {pendingDeliveryOrders.length}
                </p>
              </div>
              <div className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 shadow-sm border border-gray-100">
                <p className="text-xs sm:text-sm font-bold text-gray-500">
                  Delivered
                </p>
                <p className="text-xl sm:text-3xl font-black text-green-600 mt-1 sm:mt-2">
                  {
                    deliveryOrders.filter(
                      (o) => o.deliveryMeta.deliveryStatus === "DELIVERED",
                    ).length
                  }
                </p>
              </div>
              <div className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 shadow-sm border border-gray-100">
                <p className="text-xs sm:text-sm font-bold text-gray-500">
                  Cancelled
                </p>
                <p className="text-xl sm:text-3xl font-black text-red-600 mt-1 sm:mt-2">
                  {
                    deliveryOrders.filter(
                      (o) => o.deliveryMeta.deliveryStatus === "CANCELLED",
                    ).length
                  }
                </p>
              </div>
            </div>

            <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-lg sm:text-xl font-black text-gray-900">
                  Delivery Control Center
                </h2>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={deliverySearch}
                      onChange={(e) => setDeliverySearch(e.target.value)}
                      placeholder="Search customer, phone, address, platform, order..."
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <input
                    value={riderBranchFilter}
                    onChange={(e) => setRiderBranchFilter(e.target.value)}
                    placeholder="Branch ID (optional)"
                    className="w-full sm:w-44 px-3 py-2 bg-gray-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20"
                  />
                  <button
                    onClick={() => setIsAddRiderOpen(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
                  >
                    + Add New Rider
                  </button>
                  <button
                    onClick={() => {
                      void loadDeliveryOrders();
                      void loadDeliveryRiders(riderBranchFilter || undefined);
                    }}
                    className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-black transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {deliveryLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={`delivery-skeleton-${idx}`}
                      className="bg-white border border-gray-100 rounded-2xl sm:rounded-[28px] p-4 sm:p-5"
                    >
                      <div className="animate-pulse space-y-3">
                        <div className="h-4 w-1/3 rounded bg-gray-200" />
                        <div className="h-16 rounded-2xl bg-gray-100" />
                        <div className="h-24 rounded-2xl bg-gray-100" />
                        <div className="h-10 rounded-xl bg-gray-200" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredDeliveryOrders.length === 0 ? (
                <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100 border-dashed">
                  <p className="text-sm font-semibold text-gray-500">
                    No delivery orders found.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
                  {filteredDeliveryOrders.map((order) => {
                    const instructions = getPlainInstructions(
                      order.specialInstructions,
                    );
                    const riderDraft = deliveryRiderDraft[order.id];
                    const selectedRiderId = riderDraft?.riderId || "";
                    const selectedStatus =
                      deliveryStatusDraft[order.id] ||
                      order.deliveryMeta.deliveryStatus;
                    const selectedPaymentStatus =
                      deliveryPaymentStatusDraft[order.id] ||
                      order.paymentStatus;

                    return (
                      <div
                        key={order.id}
                        className="bg-white border border-gray-100 rounded-2xl sm:rounded-[28px] p-4 sm:p-5 hover:border-blue-200 transition-all flex flex-col h-full shadow-[0_4px_20px_rgb(0,0,0,0.03)] group"
                      >
                        {/* Delivery Info (Top) */}
                        <div className="flex-1 flex flex-col space-y-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <span className="font-black text-lg text-gray-900 leading-tight block">
                                #{order.id.slice(0, 8).toUpperCase()}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider mt-1 block text-gray-500">
                                {new Date(order.createdAt).toLocaleString(
                                  "en-IN",
                                )}
                              </span>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <span
                                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${getDeliveryStatusColor(order.deliveryMeta.deliveryStatus)}`}
                              >
                                {order.deliveryMeta.deliveryStatus.replace(
                                  /_/g,
                                  " ",
                                )}
                              </span>
                              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-gray-200 text-gray-600 bg-gray-50">
                                {order.paymentProvider || "NA"} |{" "}
                                {order.paymentStatus}
                              </span>
                            </div>
                          </div>

                          {/* Customer & Address Card */}
                          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                            <div className="mb-3">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                                Customer
                              </p>
                              <p className="text-sm font-black text-gray-900">
                                {order.deliveryMeta.customerName ||
                                  order.user?.name ||
                                  "Unknown"}
                              </p>
                              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1 mt-1">
                                <Phone className="h-3 w-3" />{" "}
                                {order.deliveryMeta.customerPhone || "NA"}
                              </p>
                            </div>
                            <div className="pt-3 border-t border-gray-200">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                                Address
                              </p>
                              <p className="text-xs font-semibold text-gray-900 flex items-start gap-1 leading-snug">
                                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />{" "}
                                {order.deliveryMeta.deliveryAddress || "NA"}
                              </p>
                              {order.deliveryMeta.landmark && (
                                <p className="text-[10px] text-gray-500 mt-1 ml-4.5 font-medium">
                                  Landmark: {order.deliveryMeta.landmark}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Financials 2x2 */}
                          <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">
                                Total
                              </p>
                              <p className="text-sm font-black text-gray-900">
                                {formatInr(order.totalPaise)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">
                                Paid
                              </p>
                              <p className="text-sm font-black text-green-600">
                                {formatInr(order.paidAmountPaise || 0)}
                              </p>
                            </div>
                            <div className="col-span-2 pt-2 border-t border-gray-200">
                              <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">
                                Due Amount
                              </p>
                              <p className="text-sm font-black text-orange-600">
                                {formatInr(order.dueAmountPaise || 0)}
                              </p>
                            </div>
                          </div>

                          {/* Items */}
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                              Items
                            </p>
                            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-1">
                              {order.items.map((item) => (
                                <p
                                  key={item.id}
                                  className="text-xs text-gray-700 font-bold flex justify-between"
                                >
                                  <span>{item.menuItem?.name || "Item"}</span>{" "}
                                  <span>x {item.quantity}</span>
                                </p>
                              ))}
                            </div>
                          </div>

                          {instructions && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                Notes
                              </p>
                              <p className="text-xs text-gray-700 bg-yellow-50 border border-yellow-100 rounded-xl p-3 font-medium">
                                {instructions}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Delivery Actions (Bottom Pushed) */}
                        <div className="w-full mt-auto pt-5">
                          <div className="bg-gray-50 rounded-[20px] p-4 border border-gray-100 group-hover:bg-white group-hover:border-blue-100 transition-colors">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                              Delivery Controls
                            </p>
                            <div className="space-y-4">
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <select
                                    value={selectedStatus}
                                    onChange={(e) =>
                                      setDeliveryStatusDraft((p) => ({
                                        ...p,
                                        [order.id]: e.target
                                          .value as DeliveryStatus,
                                      }))
                                    }
                                    className="w-full bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 appearance-none"
                                  >
                                    {(
                                      [
                                        "PLACED",
                                        "CONFIRMED",
                                        "PREPARING",
                                        "OUT_FOR_DELIVERY",
                                        "DELIVERED",
                                        "CANCELLED",
                                      ] as DeliveryStatus[]
                                    ).map((status) => (
                                      <option key={status} value={status}>
                                        {status.replace(/_/g, " ")}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                </div>
                                <button
                                  onClick={() => saveDeliveryStatus(order)}
                                  disabled={
                                    updatingDeliveryOrderId === order.id
                                  }
                                  className="px-4 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors disabled:opacity-50"
                                >
                                  Save
                                </button>
                              </div>

                              <div className="pt-3 border-t border-gray-200">
                                <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">
                                  Payment Update
                                </p>
                                <div className="relative mb-2">
                                  <select
                                    value={selectedPaymentStatus}
                                    onChange={(e) =>
                                      setDeliveryPaymentStatusDraft((p) => ({
                                        ...p,
                                        [order.id]: e.target
                                          .value as Order["paymentStatus"],
                                      }))
                                    }
                                    className="w-full bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 appearance-none"
                                  >
                                    {(
                                      [
                                        "PENDING",
                                        "PROCESSING",
                                        "COMPLETED",
                                        "FAILED",
                                        "REFUNDED",
                                        "PARTIALLY_PAID",
                                      ] as Order["paymentStatus"][]
                                    ).map((status) => (
                                      <option key={status} value={status}>
                                        {status}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                </div>
                                {selectedPaymentStatus === "PARTIALLY_PAID" && (
                                  <input
                                    value={
                                      deliveryPaymentAmountDraft[order.id] || ""
                                    }
                                    onChange={(e) =>
                                      setDeliveryPaymentAmountDraft((p) => ({
                                        ...p,
                                        [order.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="Paid Amount INR"
                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 mb-2"
                                  />
                                )}
                                <button
                                  onClick={() => saveDeliveryPayment(order)}
                                  disabled={
                                    updatingDeliveryOrderId === order.id
                                  }
                                  className="w-full bg-emerald-600 text-white rounded-xl py-2 text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm"
                                >
                                  {updatingDeliveryOrderId === order.id
                                    ? "Saving..."
                                    : "Update Payment"}
                                </button>
                              </div>

                              <div className="pt-3 border-t border-gray-200">
                                <p className="text-[10px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                  <Bike className="h-3 w-3" /> Rider Assignment
                                </p>
                                <div className="relative mb-2">
                                  <select
                                    value={selectedRiderId}
                                    onChange={(e) => {
                                      const selected = deliveryRiders.find(
                                        (rider) => rider.id === e.target.value,
                                      );
                                      setDeliveryRiderDraft((p) => ({
                                        ...p,
                                        [order.id]: {
                                          riderId: e.target.value,
                                          ...(selected?.branchId
                                            ? { branchId: selected.branchId }
                                            : {}),
                                        },
                                      }));
                                    }}
                                    className="w-full bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 appearance-none"
                                  >
                                    <option value="">
                                      Select restaurant rider
                                    </option>
                                    {deliveryRiders.map((rider) => (
                                      <option key={rider.id} value={rider.id}>
                                        {`${rider.name} • ${rider.vehicleType} • ${rider.availability}`}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                </div>
                                {order.deliveryMeta?.riderName ? (
                                  <p className="text-[11px] font-semibold text-gray-500 mb-2">
                                    Assigned: {order.deliveryMeta.riderName}{" "}
                                    {order.deliveryMeta.riderPhone
                                      ? `• ${order.deliveryMeta.riderPhone}`
                                      : ""}
                                  </p>
                                ) : null}
                                {deliveryRidersLoading ? (
                                  <p className="text-[11px] text-gray-400 mb-2">
                                    Loading rider pool...
                                  </p>
                                ) : null}
                                <button
                                  onClick={() => saveDeliveryRider(order)}
                                  disabled={
                                    updatingDeliveryOrderId === order.id ||
                                    !selectedRiderId
                                  }
                                  className="w-full bg-blue-600 text-white rounded-xl py-2 text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                                >
                                  {updatingDeliveryOrderId === order.id
                                    ? "Assigning..."
                                    : "Assign Rider"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {isAddRiderOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-md rounded-[28px] p-6 shadow-2xl border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-gray-900">
                  Add New Rider
                </h3>
                <button
                  onClick={() => setIsAddRiderOpen(false)}
                  className="p-2 rounded-full bg-gray-100 text-gray-500 hover:text-gray-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  value={newRiderForm.name}
                  onChange={(e) =>
                    setNewRiderForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Rider name"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  value={newRiderForm.phone}
                  onChange={(e) =>
                    setNewRiderForm((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  placeholder="Phone number"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  value={newRiderForm.vehicleType}
                  onChange={(e) =>
                    setNewRiderForm((prev) => ({
                      ...prev,
                      vehicleType: e.target.value,
                    }))
                  }
                  placeholder="Vehicle type"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  value={newRiderForm.branchId}
                  onChange={(e) =>
                    setNewRiderForm((prev) => ({
                      ...prev,
                      branchId: e.target.value,
                    }))
                  }
                  placeholder="Branch ID (optional)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <button
                onClick={() => void createRiderInline()}
                disabled={creatingRider}
                className="w-full mt-5 bg-blue-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {creatingRider ? "Adding Rider..." : "Save Rider"}
              </button>
            </div>
          </div>
        )}

        {/* MENU TAB */}
        {activeTab === "menu" && (
          <>
            {/* Mobile Create Button */}
            <div className="lg:hidden mb-6">
              <button
                onClick={() => setIsMenuModalOpen(true)}
                className="w-full bg-orange-600 text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95 transition-transform"
              >
                <Plus className="h-5 w-5" />
                Create New Dish
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 animate-in fade-in duration-500">
              {/* Desktop Create Dish Sidebar */}
              <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-32">
                <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
                  <h2 className="text-xl font-black text-gray-900 mb-6">
                    Create New Dish
                  </h2>
                  {renderDishForm()}
                </div>
              </div>

              {/* Menu List */}
              <div className="lg:col-span-8 bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-5 sm:mb-8">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-gray-900">
                      Current Menu
                    </h2>
                    <p className="text-xs sm:text-sm font-medium text-gray-500 mt-1">
                      {availableCount} active dishes
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {menuItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border border-gray-100 hover:border-orange-200 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">
                            {item.name}
                          </h3>
                          <span
                            className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${item.available ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                          >
                            {item.available ? "Active" : "Hidden"}
                          </span>
                        </div>
                        <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
                          {item.category?.name}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 mt-1 sm:mt-0">
                        <span className="font-black text-base sm:text-lg text-gray-900">
                          {formatInr(item.pricePaise)}
                        </span>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <button
                            onClick={() => toggleAvailability(item)}
                            className={`relative inline-flex h-6 sm:h-7 w-11 sm:w-12 items-center rounded-full transition-colors ${item.available ? "bg-orange-500" : "bg-gray-200"}`}
                          >
                            <span
                              className={`inline-block h-4 sm:h-5 w-4 sm:w-5 transform rounded-full bg-white transition-transform ${item.available ? "translate-x-6 sm:translate-x-6" : "translate-x-1 sm:translate-x-1.5"}`}
                            />
                          </button>
                          <button
                            onClick={() => removeDish(item)}
                            className="p-2 sm:p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                          >
                            <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile Form Modal */}
            {isMenuModalOpen && (
              <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 sm:p-0 animate-in fade-in duration-200 lg:hidden">
                <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 relative">
                  <button
                    onClick={() => setIsMenuModalOpen(false)}
                    className="absolute top-6 right-6 p-2 bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <h2 className="text-xl font-black text-gray-900 mb-6">
                    Create New Dish
                  </h2>
                  {renderDishForm()}
                </div>
              </div>
            )}
          </>
        )}

        {/* USERS TAB */}
        {activeTab === "users" && (
          <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
            <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 shadow-sm border border-gray-100">
              <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-1 sm:mb-2">
                Team Management
              </h2>
              <p className="text-xs sm:text-sm font-medium text-gray-500 mb-6 sm:mb-8">
                Manage staff access.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8 bg-gray-50 p-3 sm:p-4 rounded-2xl border border-gray-100">
                <input
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="employee@email.com"
                  className="w-full sm:flex-1 bg-white border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500/20"
                />
                <div className="flex gap-3">
                  <div className="relative flex-1 sm:w-32">
                    <select
                      value={userRole}
                      onChange={(e) =>
                        setUserRole(
                          e.target.value as "OWNER" | "ADMIN" | "STAFF",
                        )
                      }
                      className="w-full bg-white border-none rounded-xl pl-4 pr-8 py-3 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 appearance-none"
                    >
                      <option value="STAFF">Staff</option>
                      <option value="ADMIN">Admin</option>
                      <option value="OWNER">Owner</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                  <button
                    onClick={addRestaurantUser}
                    className="bg-gray-900 text-white font-bold px-4 py-3 rounded-xl hover:bg-black active:scale-95 transition-transform shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {restaurantUsers.map((entry) => (
                  <div
                    key={entry.membershipId}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-gray-100 bg-white gap-3 sm:gap-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-500">
                        {entry.user.name?.charAt(0) || "U"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm sm:text-base truncate">
                          {entry.user.name}
                        </p>
                        <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">
                          {entry.user.email}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`self-start sm:self-auto px-3 py-1 rounded-lg text-[10px] sm:text-xs font-black tracking-widest uppercase ${entry.role === "OWNER" ? "bg-purple-100 text-purple-700" : entry.role === "ADMIN" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"}`}
                    >
                      {entry.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === "payments" && (
          <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500">
            <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 shadow-sm border border-gray-100">
              <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-5 sm:mb-6 flex items-center gap-2">
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />{" "}
                Checkout Policy
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">
                    Collection Timing
                  </label>
                  <div className="relative">
                    <select
                      value={
                        paymentPolicy?.paymentCollectionTiming || "AFTER_MEAL"
                      }
                      onChange={(e) =>
                        setPaymentPolicy((p) => ({
                          paymentCollectionTiming: e.target.value as
                            | "BEFORE_MEAL"
                            | "AFTER_MEAL",
                          cashPaymentEnabled: p?.cashPaymentEnabled ?? true,
                        }))
                      }
                      className="w-full bg-gray-50 border-none rounded-xl pl-4 pr-10 py-4 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 appearance-none"
                    >
                      <option value="BEFORE_MEAL">
                        Collect Before Cooking
                      </option>
                      <option value="AFTER_MEAL">
                        Collect After Meal (Standard)
                      </option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center p-4 bg-gray-50 rounded-xl mt-0 sm:mt-6">
                  <label className="flex items-center gap-3 cursor-pointer w-full">
                    <div className="relative flex items-center shrink-0">
                      <input
                        type="checkbox"
                        checked={paymentPolicy?.cashPaymentEnabled ?? true}
                        onChange={(e) =>
                          setPaymentPolicy((p) => ({
                            paymentCollectionTiming:
                              p?.paymentCollectionTiming || "AFTER_MEAL",
                            cashPaymentEnabled: e.target.checked,
                          }))
                        }
                        className="peer sr-only"
                      />
                      <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-orange-500 transition-colors"></div>
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                    </div>
                    <span className="font-bold text-gray-700 text-sm sm:text-base">
                      Allow Cash Payments
                    </span>
                  </label>
                </div>
              </div>

              <button
                onClick={savePaymentPolicy}
                className="mt-6 sm:mt-8 w-full sm:w-auto bg-gray-900 text-white px-8 py-3.5 sm:py-3 rounded-xl font-bold hover:bg-black active:scale-95 transition-transform"
              >
                Save Settings
              </button>
            </div>

            <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 shadow-sm border border-gray-100">
              <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-5 sm:mb-6">
                Cash Approvals
              </h2>
              {cashOrders.length === 0 ? (
                <div className="bg-gray-50 rounded-2xl p-6 sm:p-8 text-center border border-gray-100 border-dashed">
                  <p className="text-xs sm:text-sm font-bold text-gray-500">
                    No pending collections.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {cashOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl border border-gray-100 hover:border-orange-200 transition-all gap-4 sm:gap-0"
                    >
                      <div>
                        <p className="font-black text-gray-900 text-base sm:text-lg">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs sm:text-sm font-medium text-gray-500 mt-1">
                          {order.user?.name || "Walk-in"} •{" "}
                          {formatInr(order.totalPaise)}
                        </p>
                      </div>
                      <button
                        onClick={() => confirmCashPayment(order.id)}
                        disabled={confirmingCashOrderId === order.id}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-500 text-white px-5 sm:px-6 py-3 rounded-xl font-bold hover:bg-green-600 active:scale-95 transition-transform disabled:opacity-50 text-sm"
                      >
                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                        {confirmingCashOrderId === order.id
                          ? "Approving..."
                          : "Approve Cash"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
