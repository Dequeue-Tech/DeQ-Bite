import webpush from 'web-push';
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';

type RoleScope = 'admin' | 'staff' | 'customer' | 'rider';

type WebPushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type CriticalOrderPushInput = {
  restaurantId: string;
  userId?: string;
  eventType: 'order.created' | 'order.accepted' | 'order.completed' | 'order.updated';
  orderId: string;
  status: string;
  title: string;
  body: string;
  url: string;
};

let webPushInitialized = false;

const roleScopeSet = new Set<RoleScope>(['admin', 'staff', 'customer', 'rider']);

const normalizeRoleScope = (value: unknown): RoleScope => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (roleScopeSet.has(normalized as RoleScope)) return normalized as RoleScope;
  return 'customer';
};

const getVapidConfig = () => {
  const publicKey = process.env['VAPID_PUBLIC_KEY']?.trim() || '';
  const privateKey = process.env['VAPID_PRIVATE_KEY']?.trim() || '';
  const subject = process.env['VAPID_SUBJECT']?.trim() || 'mailto:support@dequeue.co.in';
  return { publicKey, privateKey, subject };
};

const ensureWebPushConfigured = () => {
  const config = getVapidConfig();
  if (!config.publicKey || !config.privateKey) {
    return null;
  }
  if (!webPushInitialized) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    webPushInitialized = true;
  }
  return config;
};

const asPushPayload = (input: {
  title: string;
  body: string;
  url: string;
  eventType: string;
  orderId: string;
  status: string;
}) => JSON.stringify({
  title: input.title,
  body: input.body,
  icon: '/favicon.ico',
  badge: '/favicon.ico',
  tag: `${input.eventType}:${input.orderId}:${input.status}`,
  data: {
    url: input.url,
    eventType: input.eventType,
    orderId: input.orderId,
    status: input.status,
    sentAt: new Date().toISOString(),
  },
});

const isGoneSubscriptionError = (statusCode?: number) => statusCode === 404 || statusCode === 410;

export const getPublicVapidKey = () => getVapidConfig().publicKey;

export const upsertPushSubscription = async (input: {
  restaurantId: string;
  userId: string;
  roleScope?: string;
  userAgent?: string;
  subscription: WebPushSubscriptionPayload;
}) => {
  const roleScope = normalizeRoleScope(input.roleScope);
  const now = new Date().toISOString();
  const record = await prisma.pushSubscription.upsert({
    where: {
      endpoint: input.subscription.endpoint,
    },
    create: {
      restaurantId: input.restaurantId,
      userId: input.userId,
      roleScope,
      endpoint: input.subscription.endpoint,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      userAgent: input.userAgent || null,
      isActive: true,
      failureCount: 0,
      lastError: null,
      lastSuccessAt: null,
      lastFailureAt: null,
    },
    update: {
      restaurantId: input.restaurantId,
      userId: input.userId,
      roleScope,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      userAgent: input.userAgent || null,
      isActive: true,
      failureCount: 0,
      lastError: null,
    },
  });

  logger.info('PUSH_SUBSCRIPTION_REGISTERED', {
    timestamp: now,
    restaurantId: input.restaurantId,
    userId: input.userId,
    roleScope,
    endpoint: input.subscription.endpoint,
  });

  return record;
};

export const deactivatePushSubscription = async (input: {
  restaurantId: string;
  userId: string;
  endpoint: string;
}) => {
  const now = new Date().toISOString();
  const updated = await prisma.pushSubscription.updateMany({
    where: {
      restaurantId: input.restaurantId,
      userId: input.userId,
      endpoint: input.endpoint,
      isActive: true,
    },
    data: {
      isActive: false,
      lastFailureAt: new Date(),
      lastError: 'Unsubscribed by user',
    },
  });

  logger.info('PUSH_SUBSCRIPTION_DEACTIVATED', {
    timestamp: now,
    restaurantId: input.restaurantId,
    userId: input.userId,
    endpoint: input.endpoint,
    affectedRows: updated.count,
  });

  return updated.count;
};

const sendWebPushWithRetry = async (subscription: webpush.PushSubscription, payload: string, retries = 1) => {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= retries) {
    try {
      await webpush.sendNotification(subscription, payload, { TTL: 60 });
      return;
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt > retries) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  throw lastError;
};

const logPushDelivery = (input: {
  status: 'success' | 'failure' | 'skipped';
  reason?: string;
  errorMessage?: string;
  restaurantId: string;
  userId: string;
  roleScope: string;
  endpoint: string;
  orderId: string;
  eventType: string;
  startedAt: string;
}) => {
  const payload = {
    channel: 'push',
    status: input.status,
    reason: input.reason,
    errorMessage: input.errorMessage,
    restaurantId: input.restaurantId,
    userId: input.userId,
    roleScope: input.roleScope,
    endpoint: input.endpoint,
    orderId: input.orderId,
    eventType: input.eventType,
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
  };

  if (input.status === 'failure') {
    logger.error('PUSH_DELIVERY', payload);
    return;
  }
  logger.info('PUSH_DELIVERY', payload);
};

const shouldTargetRole = (roleScope: string, eventType: CriticalOrderPushInput['eventType']) => {
  if (eventType === 'order.created') return roleScope === 'admin' || roleScope === 'staff' || roleScope === 'customer';
  if (eventType === 'order.accepted') return roleScope === 'admin' || roleScope === 'staff' || roleScope === 'customer';
  return roleScope === 'admin' || roleScope === 'staff' || roleScope === 'customer';
};

export const notifyCriticalOrderPush = async (input: CriticalOrderPushInput) => {
  const config = ensureWebPushConfigured();
  if (!config) {
    logger.info('PUSH_DELIVERY', {
      channel: 'push',
      status: 'skipped',
      reason: 'missing_vapid_configuration',
      eventType: input.eventType,
      orderId: input.orderId,
      restaurantId: input.restaurantId,
    });
    return;
  }

  const subscriptions: Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userId: string;
    roleScope: string;
    failureCount: number;
  }> = await prisma.pushSubscription.findMany({
    where: {
      restaurantId: input.restaurantId,
      isActive: true,
      OR: [
        ...(input.userId ? [{ userId: input.userId }] : []),
        { roleScope: 'admin' },
        { roleScope: 'staff' },
      ],
    },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
      userId: true,
      roleScope: true,
      failureCount: true,
    },
  });

  if (subscriptions.length === 0) return;

  await Promise.all(
    subscriptions.map(async (row) => {
      if (!shouldTargetRole(row.roleScope, input.eventType) && row.userId !== input.userId) {
        return;
      }

      const startedAt = new Date().toISOString();
      const targetUrl = row.userId === input.userId ? '/orders' : '/admin';
      const payload = asPushPayload({
        title: input.title,
        body: input.body,
        url: targetUrl || input.url,
        eventType: input.eventType,
        orderId: input.orderId,
        status: input.status,
      });
      const subscription: webpush.PushSubscription = {
        endpoint: row.endpoint,
        keys: {
          p256dh: row.p256dh,
          auth: row.auth,
        },
      };

      try {
        await sendWebPushWithRetry(subscription, payload, 1);

        await prisma.pushSubscription.update({
          where: { id: row.id },
          data: {
            failureCount: 0,
            lastSuccessAt: new Date(),
            lastError: null,
          },
        });

        logPushDelivery({
          status: 'success',
          restaurantId: input.restaurantId,
          userId: row.userId,
          roleScope: row.roleScope,
          endpoint: row.endpoint,
          orderId: input.orderId,
          eventType: input.eventType,
          startedAt,
        });
      } catch (error: any) {
        const statusCode = Number(error?.statusCode || error?.status || 0) || undefined;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const nextFailureCount = row.failureCount + 1;
        const shouldDeactivate = isGoneSubscriptionError(statusCode) || nextFailureCount >= 6;

        await prisma.pushSubscription.update({
          where: { id: row.id },
          data: {
            failureCount: nextFailureCount,
            lastFailureAt: new Date(),
            lastError: errorMessage,
            ...(shouldDeactivate ? { isActive: false } : {}),
          },
        });

        logPushDelivery({
          status: 'failure',
          errorMessage,
          reason: shouldDeactivate ? 'deactivated_after_failure' : 'send_failed',
          restaurantId: input.restaurantId,
          userId: row.userId,
          roleScope: row.roleScope,
          endpoint: row.endpoint,
          orderId: input.orderId,
          eventType: input.eventType,
          startedAt,
        });
      }
    })
  );
};
