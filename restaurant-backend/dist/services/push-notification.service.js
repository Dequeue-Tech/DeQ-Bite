"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyCriticalOrderPush = exports.deactivatePushSubscription = exports.upsertPushSubscription = exports.getPublicVapidKey = void 0;
const web_push_1 = __importDefault(require("web-push"));
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
let webPushInitialized = false;
const roleScopeSet = new Set(['admin', 'staff', 'customer', 'rider']);
const normalizeRoleScope = (value) => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (roleScopeSet.has(normalized))
        return normalized;
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
        web_push_1.default.setVapidDetails(config.subject, config.publicKey, config.privateKey);
        webPushInitialized = true;
    }
    return config;
};
const asPushPayload = (input) => JSON.stringify({
    title: input.title,
    body: input.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `${input.eventType}:${input.orderId}`,
    data: {
        url: input.url,
        eventType: input.eventType,
        orderId: input.orderId,
        status: input.status,
        sentAt: new Date().toISOString(),
    },
});
const isGoneSubscriptionError = (statusCode) => statusCode === 404 || statusCode === 410;
const getPublicVapidKey = () => getVapidConfig().publicKey;
exports.getPublicVapidKey = getPublicVapidKey;
const upsertPushSubscription = async (input) => {
    const roleScope = normalizeRoleScope(input.roleScope);
    const now = new Date().toISOString();
    const record = await database_1.prisma.pushSubscription.upsert({
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
    logger_1.logger.info('PUSH_SUBSCRIPTION_REGISTERED', {
        timestamp: now,
        restaurantId: input.restaurantId,
        userId: input.userId,
        roleScope,
        endpoint: input.subscription.endpoint,
    });
    return record;
};
exports.upsertPushSubscription = upsertPushSubscription;
const deactivatePushSubscription = async (input) => {
    const now = new Date().toISOString();
    const updated = await database_1.prisma.pushSubscription.updateMany({
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
    logger_1.logger.info('PUSH_SUBSCRIPTION_DEACTIVATED', {
        timestamp: now,
        restaurantId: input.restaurantId,
        userId: input.userId,
        endpoint: input.endpoint,
        affectedRows: updated.count,
    });
    return updated.count;
};
exports.deactivatePushSubscription = deactivatePushSubscription;
const sendWebPushWithRetry = async (subscription, payload, retries = 1) => {
    let attempt = 0;
    let lastError;
    while (attempt <= retries) {
        try {
            await web_push_1.default.sendNotification(subscription, payload, { TTL: 60 });
            return;
        }
        catch (error) {
            lastError = error;
            attempt += 1;
            if (attempt > retries)
                break;
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
        }
    }
    throw lastError;
};
const logPushDelivery = (input) => {
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
        logger_1.logger.error('PUSH_DELIVERY', payload);
        return;
    }
    logger_1.logger.info('PUSH_DELIVERY', payload);
};
const shouldTargetRole = (roleScope, eventType) => {
    if (eventType === 'order.created')
        return roleScope === 'admin' || roleScope === 'staff' || roleScope === 'customer';
    if (eventType === 'order.accepted')
        return roleScope === 'admin' || roleScope === 'staff' || roleScope === 'customer';
    return roleScope === 'admin' || roleScope === 'staff' || roleScope === 'customer';
};
const notifyCriticalOrderPush = async (input) => {
    const config = ensureWebPushConfigured();
    if (!config) {
        logger_1.logger.info('PUSH_DELIVERY', {
            channel: 'push',
            status: 'skipped',
            reason: 'missing_vapid_configuration',
            eventType: input.eventType,
            orderId: input.orderId,
            restaurantId: input.restaurantId,
        });
        return;
    }
    const subscriptions = await database_1.prisma.pushSubscription.findMany({
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
    if (subscriptions.length === 0)
        return;
    await Promise.all(subscriptions.map(async (row) => {
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
        const subscription = {
            endpoint: row.endpoint,
            keys: {
                p256dh: row.p256dh,
                auth: row.auth,
            },
        };
        try {
            await sendWebPushWithRetry(subscription, payload, 1);
            await database_1.prisma.pushSubscription.update({
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
        }
        catch (error) {
            const statusCode = Number(error?.statusCode || error?.status || 0) || undefined;
            const errorMessage = error instanceof Error ? error.message : String(error);
            const nextFailureCount = row.failureCount + 1;
            const shouldDeactivate = isGoneSubscriptionError(statusCode) || nextFailureCount >= 6;
            await database_1.prisma.pushSubscription.update({
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
    }));
};
exports.notifyCriticalOrderPush = notifyCriticalOrderPush;
//# sourceMappingURL=push-notification.service.js.map