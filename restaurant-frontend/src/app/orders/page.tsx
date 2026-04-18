'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { isHapticsEnabled, setHapticsEnabled, triggerHaptic } from '@/lib/haptics';
import { ensurePushSubscription, syncPushSubscriptionIfGranted } from '@/lib/push-notifications';

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
      return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, label: 'Pending' };
    case 'CONFIRMED':
      return { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock, label: 'Confirmed' };
    case 'PREPARING':
      return { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: ChefHat, label: 'Preparing' };
    case 'READY':
      return { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: ShoppingBag, label: 'Ready' };
    case 'SERVED':
      return { color: 'bg-teal-100 text-teal-800 border-teal-200', icon: MapPin, label: 'Served' };
    case 'COMPLETED':
      return { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, label: 'Completed' };
    case 'CANCELLED':
      return { color: 'bg-red-100 text-red-800 border-red-200', icon: X, label: 'Cancelled' };
    default:
      return { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Receipt, label: status };
  }
};

type OrderNotification = {
  id: string;
  orderId: string;
  title: string;
  subtitle: string;
  status: string;
  alertType?: 'new-order' | 'accepted' | 'status-update' | 'payment-update' | 'invoice';
  timestamp: number;
  unread: boolean;
};

const statusTimeline = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'] as const;
const orderTimelineSteps = [
  { key: 'PENDING', label: 'Order Placed' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'READY', label: 'Ready' },
] as const;

const toRelativeTime = (timestamp: number) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 8) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export default function OrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLimit] = useState(6); // Changed limit to 6 (looks better in a 3-col grid than 5)
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [payNowOrderId, setPayNowOrderId] = useState<string | null>(null);
  const [couponByOrder, setCouponByOrder] = useState<Record<string, string>>({});
  const [applyingCouponOrderId, setApplyingCouponOrderId] = useState<string | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);
  const [sendingInvoice, setSendingInvoice] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'PAST'>('ACTIVE');
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [expandedNotificationOrderId, setExpandedNotificationOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      setOrdersPage(1);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || !user || typeof window === 'undefined') return;
    syncPushSubscriptionIfGranted('customer').catch(() => undefined);
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchOrders(ordersPage);
    }
  }, [isAuthenticated, user, ordersPage]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const interval = setInterval(() => {
      const fallbackWindow = new Date(Date.now() - 90 * 1000).toISOString();
      fetchOrdersDelta(fallbackWindow).catch(() => undefined);
    }, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || !user || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const onServiceWorkerMessage = (event: MessageEvent) => {
      const message = event.data as {
        type?: string;
        payload?: {
          title?: string;
          body?: string;
          data?: {
            orderId?: string;
            status?: string;
            eventType?: string;
            sentAt?: string;
          };
        };
      };

      if (message?.type !== 'push:order') return;
      const orderId = message.payload?.data?.orderId || '';
      if (!orderId) return;

      const status = (message.payload?.data?.status || 'UPDATED').toUpperCase();
      const eventType = (message.payload?.data?.eventType || '').toLowerCase();
      const title =
        message.payload?.title ||
        `Order #${orderId.slice(0, 8).toUpperCase()} - ${status.replace(/_/g, ' ')}`;
      const subtitle = message.payload?.body || `Order status is now ${status.replace(/_/g, ' ')}`;
      const alertType: OrderNotification['alertType'] =
        eventType === 'order.accepted'
          ? 'accepted'
          : eventType === 'order.created'
            ? 'new-order'
            : 'status-update';

      enqueueNotifications([
        {
          id: `push-${orderId}-${status}-${Date.now()}`,
          orderId,
          title,
          subtitle,
          status,
          alertType,
          timestamp: Date.now(),
          unread: true,
        },
      ]);

      const fallbackWindow = new Date(Date.now() - 90 * 1000).toISOString();
      fetchOrdersDelta(fallbackWindow).catch(() => undefined);
    };

    navigator.serviceWorker.addEventListener('message', onServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onServiceWorkerMessage);
    };
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || !user || typeof window === 'undefined') return;
    const cleanup = subscribeToOrderEvents({
      scope: 'user',
      role: 'customer',
      onEvent: (event) => {
        if (event?.type === 'invoice.ready') {
          const orderId = event?.payload?.orderId as string | undefined;
          if (!orderId) return;
          const delivery = event?.payload?.delivery as { emailSent?: boolean; smsSent?: boolean } | undefined;
          if (delivery?.emailSent && delivery?.smsSent) {
            toast.success('Invoice sent! Check your SMS & email.');
          }
          enqueueNotifications([
            {
              id: `invoice-${orderId}-${Date.now()}`,
              orderId,
              title: `Order #${orderId.slice(0, 8).toUpperCase()} - Invoice Ready`,
              subtitle: 'Invoice generated and ready to download',
              status: 'INVOICE_READY',
              alertType: 'invoice',
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
        fetchOrdersDelta(lastSyncTimestamp).catch(() => undefined);
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
        const parsed = JSON.parse(stored) as Array<any>;
        const normalized = parsed
          .map((entry) => ({
            id: String(entry.id || `${entry.orderId || 'order'}-${Date.now()}`),
            orderId: String(entry.orderId || entry.id || ''),
            title: String(entry.title || entry.message || 'Order Update'),
            subtitle: String(entry.subtitle || entry.message || ''),
            status: String(entry.status || 'UPDATE'),
            alertType:
              entry.alertType === 'new-order' ||
              entry.alertType === 'accepted' ||
              entry.alertType === 'status-update' ||
              entry.alertType === 'payment-update' ||
              entry.alertType === 'invoice'
                ? entry.alertType
                : undefined,
            timestamp: Number(entry.timestamp || Date.now()),
            unread: Boolean(entry.unread ?? false),
          }))
          .filter((entry) => entry.orderId);
        setNotifications(normalized);
      }
    } catch {
      // ignore
    }
    setHapticsEnabledState(isHapticsEnabled());
    try {
      const soundPref = localStorage.getItem('order_notification_sound');
      setSoundEnabled(soundPref !== 'off');
    } catch {
      // ignore
    }
  }, []);

  const enqueueNotifications = (newNotifs: OrderNotification[]) => {
    if (!newNotifs.length) return;

    const playOrderTone = (variant: 'accepted' | 'default') => {
      if (typeof window === 'undefined') return;
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const scheduleTone = (frequency: number, startOffset: number, duration: number) => {
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          gain.gain.value = 0.05;
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          const startAt = audioContext.currentTime + startOffset;
          oscillator.start(startAt);
          oscillator.stop(startAt + duration);
        };

        if (variant === 'accepted') {
          scheduleTone(740, 0, 0.11);
          scheduleTone(1040, 0.14, 0.16);
          return;
        }
        scheduleTone(860, 0, 0.11);
      } catch {
        // ignore audio errors
      }
    };

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      newNotifs.slice(0, 3).forEach((note) => {
        try {
          new Notification('Order Update', {
            body: `${note.title}${note.subtitle ? ` - ${note.subtitle}` : ''}`,
            tag: note.id,
          });
        } catch {
          // ignore notification errors
        }
      });
    }

    if (hapticsEnabled) {
      const latest = newNotifs[0];
      if (latest?.status === 'DELIVERED') {
        triggerHaptic('order_delivered');
      } else if (latest?.status === 'CONFIRMED') {
        triggerHaptic('order_confirmed');
      } else {
        triggerHaptic('status_update');
      }
    }

    if (soundEnabled) {
      const hasAccepted = newNotifs.some((note) => note.alertType === 'accepted');
      playOrderTone(hasAccepted ? 'accepted' : 'default');
    }

    setNotifications((prev) => {
      const byOrder = new Map<string, OrderNotification>();
      [...newNotifs, ...prev].forEach((entry) => {
        const existing = byOrder.get(entry.orderId);
        if (!existing || entry.timestamp >= existing.timestamp) {
          byOrder.set(entry.orderId, entry);
        }
      });
      const merged = Array.from(byOrder.values()).sort((a, b) => b.timestamp - a.timestamp).slice(0, 80);
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

  const handleRealtimeOrderUpdate = (
    incoming: Partial<Order> & { id: string },
    eventType?: string,
    eventId?: string
  ) => {
    let added = false;
    const nextNotifications: OrderNotification[] = [];
    const isCreatedEvent = eventType === 'order.created';
    const isAcceptedEvent = eventType === 'order.accepted';
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

      if (isAcceptedEvent) {
        nextNotifications.push({
          id: eventId || `${incoming.id}-accepted-${Date.now()}`,
          orderId: incoming.id,
          title: `Order #${incoming.id.slice(0, 8).toUpperCase()} - Accepted`,
          subtitle: 'Your order has been accepted.',
          status: incoming.status || nextOrder.status || 'CONFIRMED',
          alertType: 'accepted',
          timestamp: Date.now(),
          unread: true,
        });
      } else if (existing) {
        if (incoming.status && incoming.status !== existing.status) {
          nextNotifications.push({
            id: `${incoming.id}-status-${Date.now()}`,
            orderId: incoming.id,
            title:
              incoming.status === 'CONFIRMED'
                ? `Order #${incoming.id.slice(0, 8).toUpperCase()} - Accepted`
                : `Order #${incoming.id.slice(0, 8).toUpperCase()} - ${incoming.status.replace(/_/g, ' ')}`,
            subtitle:
              incoming.status === 'CONFIRMED'
                ? 'Your order has been accepted.'
                : `Status changed from ${existing.status} to ${incoming.status}`,
            status: incoming.status,
            alertType: incoming.status === 'CONFIRMED' ? 'accepted' : 'status-update',
            timestamp: Date.now(),
            unread: true,
          });
        }
        if (incoming.paymentStatus && incoming.paymentStatus !== existing.paymentStatus) {
          nextNotifications.push({
            id: `${incoming.id}-payment-${Date.now()}`,
            orderId: incoming.id,
            title: `Order #${incoming.id.slice(0, 8).toUpperCase()} - Payment ${incoming.paymentStatus}`,
            subtitle: `Payment status updated from ${existing.paymentStatus} to ${incoming.paymentStatus}`,
            status: incoming.paymentStatus,
            alertType: 'payment-update',
            timestamp: Date.now(),
            unread: true,
          });
        }
      } else {
        nextNotifications.push({
          id: eventId || `${incoming.id}-new-${Date.now()}`,
          orderId: incoming.id,
          title:
            isCreatedEvent
              ? `Order #${incoming.id.slice(0, 8).toUpperCase()} - Placed`
              : `Order #${incoming.id.slice(0, 8).toUpperCase()} - Updated`,
          subtitle:
            isCreatedEvent
              ? 'Your order was placed successfully'
              : 'Order details were updated',
          status: incoming.status || 'PENDING',
          alertType: isCreatedEvent ? 'new-order' : 'status-update',
          timestamp: Date.now(),
          unread: true,
        });
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

    if (nextNotifications.length) {
      enqueueNotifications(nextNotifications);
    }

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
          const newNotifs: OrderNotification[] = [];

          nextOrders.forEach((order) => {
            const prev = snapshot[order.id];
            if (prev && prev.status !== order.status) {
              newNotifs.push({
                id: `${order.id}-status-${Date.now()}`,
                orderId: order.id,
                title:
                  order.status === 'CONFIRMED'
                    ? `Order #${order.id.slice(0, 8).toUpperCase()} - Accepted`
                    : `Order #${order.id.slice(0, 8).toUpperCase()} - ${order.status.replace(/_/g, ' ')}`,
                subtitle:
                  order.status === 'CONFIRMED'
                    ? 'Your order has been accepted.'
                    : `Status changed from ${prev.status} to ${order.status}`,
                status: order.status,
                alertType: order.status === 'CONFIRMED' ? 'accepted' : 'status-update',
                timestamp: Date.now(),
                unread: true,
              });
            }
            if (prev && prev.paymentStatus !== order.paymentStatus) {
              newNotifs.push({
                id: `${order.id}-payment-${Date.now()}`,
                orderId: order.id,
                title: `Order #${order.id.slice(0, 8).toUpperCase()} - Payment ${order.paymentStatus}`,
                subtitle: `Payment status updated from ${prev.paymentStatus} to ${order.paymentStatus}`,
                status: order.paymentStatus,
                alertType: 'payment-update',
                timestamp: Date.now(),
                unread: true,
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

  const fetchOrdersDelta = async (updatedAfter: string) => {
    const response = await apiClient.getOrdersPage(1, 100, updatedAfter);
    if (!response.success || !response.data?.length) return;
    response.data.forEach((order) => {
      handleRealtimeOrderUpdate(order);
    });
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

      const methods: Array<'EMAIL' | 'SMS'> = ['EMAIL'];
      if (user?.phone) {
        methods.push('SMS');
      }

      let sendResult: any;
      try {
        const invoiceResponse = await apiClient.getInvoice(orderId);
        if (invoiceResponse?.invoice) {
          sendResult = await apiClient.resendInvoice(invoiceResponse.invoice.id, methods);
        } else {
          sendResult = await apiClient.generateInvoice(orderId, methods);
        }
      } catch {
        sendResult = await apiClient.generateInvoice(orderId, methods);
      }

      const emailSent = Boolean(sendResult?.deliveryResults?.emailSent);
      const smsSent = Boolean(sendResult?.deliveryResults?.smsSent);

      if (!emailSent && !smsSent) {
        const emailWarning = Array.isArray(sendResult?.warnings)
          ? sendResult.warnings.find((warning: string) => warning.toLowerCase().includes('email'))
          : null;
        throw new Error(emailWarning || 'Email delivery failed. Please check email configuration and try again.');
      }
      if (emailSent && smsSent) {
        toast.success('Invoice sent via email and SMS');
      } else if (emailSent) {
        toast.success('Invoice sent to your email');
      } else {
        toast.success('Email failed, but invoice SMS was sent');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send invoice');
    } finally {
      setSendingInvoice(null);
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Browser notifications are not supported');
      triggerHaptic('error');
      return;
    }
    try {
      await ensurePushSubscription('customer');
      setNotificationPermission('granted');
      localStorage.setItem('customer_notification_subscription', JSON.stringify({
        permission: 'granted',
        grantedAt: new Date().toISOString(),
      }));
      toast.success('Browser notifications enabled');
      triggerHaptic('primary_action');
    } catch (error: any) {
      const currentPermission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
      setNotificationPermission(currentPermission as NotificationPermission);
      if (currentPermission === 'denied') {
        toast.error('Notifications blocked. Enable them in browser settings.');
      } else {
        toast.error(error?.message || 'Unable to enable notifications');
      }
      triggerHaptic('error');
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
      const expectedUpdatedAt = orders.find((order) => order.id === orderId)?.updatedAt;
      const response = await apiClient.applyCouponToOrder(
        orderId,
        couponCode,
        expectedUpdatedAt ? { expectedUpdatedAt } : undefined
      );
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
  const notificationGroups = useMemo(() => {
    const grouped = new Map<
      string,
      {
        orderId: string;
        latest: OrderNotification;
        history: OrderNotification[];
        unread: boolean;
      }
    >();

    notifications.forEach((note) => {
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
  }, [notifications]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] pb-32">
      {/* Changed max-w-3xl to max-w-7xl to allow grid to expand on desktop */}
      <div className="max-w-7xl mx-auto px-4 pt-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8 max-w-3xl mx-auto">
          <button onClick={() => router.back()} className="p-3 -ml-3 hover:bg-gray-50 rounded-full transition-colors active:scale-95">
            <ArrowLeft className="h-6 w-6 text-gray-900" />
          </button>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">My Orders</h1>
          <div className="flex items-center gap-1">
            {notificationPermission !== 'granted' && (
              <button
                onClick={requestNotificationPermission}
                className="p-3 hover:bg-orange-50 rounded-full transition-colors text-orange-600"
                title="Enable order notifications"
              >
                <BellRing className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={() => fetchOrders(ordersPage)}
              disabled={loading}
              className="p-3 -mr-3 hover:bg-gray-50 rounded-full transition-colors disabled:opacity-50 text-orange-600"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* High-End Pill Navigation */}
        <div className="relative mb-6 max-w-3xl mx-auto">
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

        {/* Notifications Panel */}
        {activeTab === 'ACTIVE' && notificationGroups.length > 0 && (
          <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-gray-200 p-0 mb-6 shadow-sm overflow-hidden">
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    localStorage.setItem('order_notification_sound', next ? 'on' : 'off');
                  }}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                    soundEnabled ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  Sound
                </button>
                <button
                  onClick={() => {
                    const next = !hapticsEnabled;
                    setHapticsEnabledState(next);
                    setHapticsEnabled(next);
                  }}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                    hapticsEnabled ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  Haptics
                </button>
              </div>
              <button
                onClick={() => {
                  setNotifications([]);
                  setExpandedNotificationOrderId(null);
                  localStorage.setItem('order_notifications', JSON.stringify([]));
                }}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                Clear
              </button>
            </div>
            <div className="max-h-[360px] overflow-y-auto thin-scrollbar px-3 py-3 space-y-2">
              {notificationGroups.slice(0, 5).map((group) => {
                const status = group.latest.status.toUpperCase();
                const accentClass =
                  status.includes('CANCEL') || status.includes('FAILED')
                    ? 'border-l-red-500'
                    : status.includes('DELIVER')
                      ? 'border-l-green-500'
                      : status.includes('OUT_FOR_DELIVERY')
                        ? 'border-l-orange-500'
                        : status.includes('PREPAR')
                          ? 'border-l-blue-500'
                          : 'border-l-yellow-500';
                return (
                  <div
                    key={group.orderId}
                    className={`border border-gray-200 border-l-4 ${accentClass} rounded-xl p-3 transition-colors ${
                      group.unread ? 'bg-orange-50/40' : 'bg-white'
                    }`}
                  >
                    <button
                      className="w-full flex items-start justify-between gap-2 text-left"
                      onClick={() => {
                        setExpandedNotificationOrderId((prev) => (prev === group.orderId ? null : group.orderId));
                        setNotifications((prev) => {
                          const next = prev.map((note) =>
                            note.orderId === group.orderId ? { ...note, unread: false } : note
                          );
                          localStorage.setItem('order_notifications', JSON.stringify(next));
                          return next;
                        });
                      }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900 truncate">{group.latest.title}</p>
                        {/* <p className="text-xs text-gray-500 truncate">{group.latest.subtitle}</p> */}
                      </div>
                      <span className="text-[10px] font-semibold text-gray-400 whitespace-nowrap">
                        {toRelativeTime(group.latest.timestamp)}
                      </span>
                    </button>
                    {expandedNotificationOrderId === group.orderId && (
                      <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                        {group.history.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between gap-2 text-xs text-gray-600">
                            <span className="truncate">{entry.subtitle}</span>
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

        {/* Pagination Controls */}
        <div className="flex items-center justify-between mb-6 max-w-3xl mx-auto">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: ordersLimit }).map((_, idx) => (
              <div key={`order-skeleton-${idx}`} className="bg-white rounded-[32px] p-6 border border-gray-100">
                <div className="animate-pulse space-y-4">
                  <div className="h-5 w-1/2 rounded bg-gray-200" />
                  <div className="h-12 rounded-2xl bg-gray-100" />
                  <div className="h-14 rounded-2xl bg-gray-100" />
                  <div className="h-24 rounded-2xl bg-gray-100" />
                  <div className="h-10 rounded-xl bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="bg-white rounded-[32px] border border-gray-100 p-10 text-center shadow-[0_4px_20px_rgb(0,0,0,0.02)] mt-4 max-w-3xl mx-auto">
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
          /* Changed from space-y-6 to grid to allow 3 columns on desktop */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayOrders.map((order) => {
              const badge = getStatusBadge(order.status);
              const BadgeIcon = badge.icon;
              const isOngoing = !['COMPLETED', 'CANCELLED'].includes(order.status);
              const canPayNow = order.paymentStatus !== 'COMPLETED' && order.paymentProvider !== 'CASH';              
              const itemsList = Array.isArray(order.items) ? order.items : [];
              const itemSummary = itemsList.length > 0 
                ? itemsList.map(i => `${i.quantity}x ${i.menuItem?.name || 'Item'}`).join(', ')
                : 'No items detailed';

              return (
                <div 
                  key={order.id} 
                  className="bg-white flex flex-col rounded-[32px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 transition-all hover:border-orange-200 group"
                >
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

                  {/* <div className="mb-5 rounded-2xl border border-gray-100 bg-white/70 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Order Timeline</p>
                    <div className="grid grid-cols-3 gap-2">
                      {orderTimelineSteps.map((step, stepIndex) => {
                        const isActive = stepIndex <= timelineIndex;
                        const isCurrent = stepIndex === timelineIndex;
                        return (
                          <div key={`${order.id}-${step.key}`} className="min-w-0">
                            <div
                              className={`h-1.5 rounded-full transition-colors ${
                                isActive ? 'bg-orange-500' : 'bg-gray-200'
                              } ${isCurrent ? 'animate-pulse' : ''}`}
                            />
                            <p className={`mt-1 text-[10px] font-semibold leading-tight ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>
                              {step.label}
                            </p>
                            {isCurrent && order.estimatedTime ? (
                              <p className="text-[9px] font-medium text-orange-600">~{order.estimatedTime} min</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div> */}

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
                              <span className="font-medium text-gray-200 truncate max-w-[150px]">{item.menuItem?.name || 'Item'}</span>
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
                      
                      <div className="flex flex-col xl:flex-row gap-3">
                        <div className="relative flex-1">
                          <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400" />
                          <input
                            value={couponByOrder[order.id] || ''}
                            onChange={(e) => setCouponByOrder((prev) => ({ ...prev, [order.id]: e.target.value }))}
                            placeholder="Promo code"
                            className="w-full pl-10 pr-4 py-3 bg-white border border-orange-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-500/20"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApplyCouponToOrder(order.id)}
                            disabled={applyingCouponOrderId === order.id}
                            className="px-4 py-3 bg-orange-200 text-orange-900 font-bold rounded-xl hover:bg-orange-300 disabled:opacity-60 text-sm whitespace-nowrap active:scale-95 transition-transform"
                          >
                            {applyingCouponOrderId === order.id ? '...' : 'Apply'}
                          </button>
                          <button
                            onClick={() => router.push(apiClient.buildRestaurantPath(`/checkout?orderId=${order.id}&payNow=1`))}
                            className="flex-1 px-4 py-3 bg-orange-600 text-white font-black rounded-xl hover:bg-orange-700 text-sm whitespace-nowrap shadow-md shadow-orange-500/20 active:scale-95 transition-transform"
                          >
                            Pay
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card Footer Actions - Pushed to bottom with mt-auto */}
                  <div className="flex flex-wrap items-center justify-between pt-4 gap-4 mt-auto border-t border-gray-100">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Total</p>
                      <p className="text-2xl font-black text-gray-900">{formatInr(order.totalPaise)}</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {isOngoing && (
                        <button
                          onClick={() => router.push(apiClient.buildRestaurantPath(`/menu?orderId=${order.id}`))}
                          className="px-3 py-2.5 bg-gray-50 text-gray-900 rounded-xl hover:bg-gray-100 font-bold flex items-center text-sm transition-colors"
                        >
                          <PlusCircle className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Add Items</span>
                        </button>
                      )}

                      {canPayNow && (
                        <button
                          onClick={() => setPayNowOrderId(payNowOrderId === order.id ? null : order.id)}
                          className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-colors border-2 ${
                            payNowOrderId === order.id 
                            ? 'bg-gray-900 text-white border-gray-900' 
                            : 'bg-white text-orange-600 border-orange-600 hover:bg-orange-50'
                          }`}
                        >
                          {payNowOrderId === order.id ? 'Cancel' : 'Pay Now'}
                        </button>
                      )}

                      {order.paymentProvider === 'CASH' && order.paymentStatus !== 'COMPLETED' && (
                        <div className="px-3 py-2 bg-orange-50 text-orange-800 rounded-xl border border-orange-200 text-xs font-bold flex items-center">
                          <Info className="h-4 w-4 mr-1.5" /> Cash pending
                        </div>
                      )}

                      {/* Download/Send Invoices for Completed Orders */}
                      {order.paymentStatus === 'COMPLETED' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDownloadInvoice(order.id)}
                            disabled={downloadingInvoice === order.id}
                            className="px-3 py-2 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 font-bold flex items-center text-sm transition-colors"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleSendInvoice(order.id)}
                            disabled={sendingInvoice === order.id}
                            className="px-3 py-2 bg-gray-900 text-white rounded-xl hover:bg-black font-bold flex items-center text-sm transition-colors"
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                        </div>
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
