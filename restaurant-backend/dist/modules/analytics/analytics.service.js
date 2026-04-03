"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalyticsOverview = exports.generateAnalyticsSnapshot = void 0;
const database_1 = require("../../config/database");
const redis_1 = require("../../utils/redis");
const cacheTtlSeconds = 120;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const toIsoDate = (value) => value.toISOString().split('T')[0];
const getDailyBounds = (date) => {
    const localDate = new Date(date.getTime() + IST_OFFSET_MS);
    localDate.setUTCHours(0, 0, 0, 0);
    const start = new Date(localDate.getTime() - IST_OFFSET_MS);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
};
const getWeeklyBounds = (date) => {
    const localDate = new Date(date.getTime() + IST_OFFSET_MS);
    const day = localDate.getUTCDay() || 7;
    localDate.setUTCHours(0, 0, 0, 0);
    localDate.setUTCDate(localDate.getUTCDate() - (day - 1));
    const start = new Date(localDate.getTime() - IST_OFFSET_MS);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { start, end };
};
const buildInsights = (snapshot, periodType, periodStart, periodEnd) => {
    const label = periodType === 'DAILY' ? 'daily' : 'weekly';
    const revenueRupees = (snapshot.revenuePaise / 100).toFixed(2);
    const topItem = snapshot.topItems[0];
    const busiest = snapshot.peakHours[0];
    const insights = [
        `${label.toUpperCase()} summary (${toIsoDate(periodStart)} to ${toIsoDate(periodEnd)}): ${snapshot.completedOrders} completed orders generated INR ${revenueRupees} in revenue.`,
        topItem
            ? `Top performing item was ${topItem.name} with ${topItem.quantity} orders and INR ${(topItem.revenuePaise / 100).toFixed(2)} sales.`
            : 'No top item trend available due to low order volume.',
        busiest
            ? `Peak demand occurred around ${busiest.hour}:00 with ${busiest.orders} orders.`
            : 'No clear peak hour trend was observed.',
        `Cancellation rate is ${snapshot.cancellationRatePct}% and payment completion is ${snapshot.paymentCompletionRatePct}%.`,
    ].join(' ');
    const recommendations = [
        topItem
            ? `Keep ${topItem.name} fully prepped before ${busiest ? `${busiest.hour}:00` : 'rush hours'} to reduce kitchen delays.`
            : 'Promote combo offers during low demand windows to lift order count.',
        snapshot.avgOrderValuePaise < 45000
            ? 'Average order value is below INR 450. Consider upsell prompts and add-on bundles.'
            : 'Average order value is healthy. Focus on repeat retention via loyalty points.',
        snapshot.repeatCustomerRatePct < 25
            ? 'Repeat-customer ratio is low. Launch comeback offers and post-meal CRM nudges.'
            : 'Repeat customer ratio is healthy. Keep loyalty campaigns running for high-value guests.',
        snapshot.completedOrders > 0 && snapshot.revenuePaise / snapshot.completedOrders < 60000
            ? 'Track recipe costs for high-volume low-margin items and tune pricing.'
            : 'Current order mix looks balanced. Maintain inventory buffers for top movers.',
    ].join(' ');
    return { insights, recommendations };
};
const computeMetrics = async (restaurantId, start, end) => {
    const totalOrdersAggr = await database_1.prisma.order.aggregate({
        where: { restaurantId, createdAt: { gte: start, lt: end } },
        _count: { id: true }
    });
    const completedOrdersAggr = await database_1.prisma.order.aggregate({
        where: { restaurantId, createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
        _count: { id: true },
        _sum: { totalPaise: true }
    });
    const paymentCompletedAggr = await database_1.prisma.order.aggregate({
        where: { restaurantId, createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' }, paymentStatus: 'COMPLETED' },
        _count: { id: true }
    });
    const totalOrders = totalOrdersAggr._count.id || 0;
    const completedOrderCount = completedOrdersAggr._count.id || 0;
    const revenuePaise = completedOrdersAggr._sum.totalPaise || 0;
    const cancelledOrders = totalOrders - completedOrderCount;
    const paymentCompletedOrders = paymentCompletedAggr._count.id || 0;
    const avgOrderValuePaise = completedOrderCount > 0 ? Math.round(revenuePaise / completedOrderCount) : 0;
    const cancellationRatePct = totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0;
    const paymentCompletionRatePct = completedOrderCount > 0 ? Math.round((paymentCompletedOrders / completedOrderCount) * 100) : 0;
    const lightOrders = await database_1.prisma.order.findMany({
        where: { restaurantId, createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
        select: { userId: true, createdAt: true }
    });
    const userCounts = new Map();
    const hourMap = new Map();
    for (const order of lightOrders) {
        if (order.userId) {
            userCounts.set(order.userId, (userCounts.get(order.userId) || 0) + 1);
        }
        const localHour = new Date(order.createdAt.getTime() + IST_OFFSET_MS).getUTCHours();
        hourMap.set(localHour, (hourMap.get(localHour) || 0) + 1);
    }
    const uniqueCustomers = userCounts.size;
    const repeatCustomers = Array.from(userCounts.values()).filter(count => count > 1).length;
    const repeatCustomerRatePct = uniqueCustomers > 0 ? Math.round((repeatCustomers / uniqueCustomers) * 100) : 0;
    const peakHours = Array.from(hourMap.entries())
        .map(([hour, ordersCount]) => ({ hour, orders: ordersCount }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5);
    const orderItems = await database_1.prisma.orderItem.findMany({
        where: { order: { restaurantId, createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } } },
        select: { menuItemId: true, quantity: true, pricePaise: true, menuItem: { select: { name: true } } }
    });
    const topItemsMap = new Map();
    for (const item of orderItems) {
        const existing = topItemsMap.get(item.menuItemId) || {
            menuItemId: item.menuItemId,
            name: item.menuItem.name,
            quantity: 0,
            revenuePaise: 0,
        };
        existing.quantity += item.quantity;
        existing.revenuePaise += item.quantity * item.pricePaise;
        topItemsMap.set(item.menuItemId, existing);
    }
    const topItems = Array.from(topItemsMap.values())
        .sort((a, b) => b.revenuePaise - a.revenuePaise)
        .slice(0, 5);
    return {
        revenuePaise,
        completedOrders: completedOrderCount,
        totalOrders,
        cancelledOrders,
        avgOrderValuePaise,
        uniqueCustomers,
        repeatCustomers,
        cancellationRatePct,
        paymentCompletionRatePct,
        repeatCustomerRatePct,
        topItems,
        peakHours,
        metrics: {
            conversionHint: completedOrderCount === 0 ? 'No completed orders in this period' : 'Operational',
            totalOrders,
            cancelledOrders,
            uniqueCustomers,
            repeatCustomers,
            cancellationRatePct,
            paymentCompletionRatePct,
            repeatCustomerRatePct,
        },
    };
};
const generateAnalyticsSnapshot = async (params) => {
    const date = params.date || new Date();
    const bounds = params.periodType === 'DAILY' ? getDailyBounds(date) : getWeeklyBounds(date);
    const cacheKey = `analytics:${params.restaurantId}:${params.periodType}:${bounds.start.toISOString()}:${bounds.end.toISOString()}`;
    const redis = (0, redis_1.getRedisClient)();
    if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.generatedAt)
                parsed.generatedAt = new Date(parsed.generatedAt);
            if (parsed.periodStart)
                parsed.periodStart = new Date(parsed.periodStart);
            if (parsed.periodEnd)
                parsed.periodEnd = new Date(parsed.periodEnd);
            return parsed;
        }
    }
    const snapshot = await computeMetrics(params.restaurantId, bounds.start, bounds.end);
    const text = buildInsights(snapshot, params.periodType, bounds.start, bounds.end);
    const saved = await database_1.prisma.analyticsSnapshot.upsert({
        where: {
            restaurantId_periodType_periodStart_periodEnd: {
                restaurantId: params.restaurantId,
                periodType: params.periodType,
                periodStart: bounds.start,
                periodEnd: bounds.end,
            },
        },
        update: {
            revenuePaise: snapshot.revenuePaise,
            orderCount: snapshot.completedOrders,
            avgOrderValuePaise: snapshot.avgOrderValuePaise,
            topItems: snapshot.topItems,
            peakHours: snapshot.peakHours,
            metrics: snapshot.metrics,
            insights: text.insights,
            recommendations: text.recommendations,
            generatedAt: new Date(),
        },
        create: {
            restaurantId: params.restaurantId,
            periodType: params.periodType,
            periodStart: bounds.start,
            periodEnd: bounds.end,
            revenuePaise: snapshot.revenuePaise,
            orderCount: snapshot.completedOrders,
            avgOrderValuePaise: snapshot.avgOrderValuePaise,
            topItems: snapshot.topItems,
            peakHours: snapshot.peakHours,
            metrics: snapshot.metrics,
            insights: text.insights,
            recommendations: text.recommendations,
        },
    });
    if (redis) {
        await redis.setex(cacheKey, cacheTtlSeconds, JSON.stringify(saved));
    }
    return saved;
};
exports.generateAnalyticsSnapshot = generateAnalyticsSnapshot;
const computeRangeMetrics = async (params) => {
    const snapshot = await computeMetrics(params.restaurantId, params.start, params.end);
    return {
        revenuePaise: snapshot.revenuePaise,
        completedOrders: snapshot.completedOrders,
        totalOrders: snapshot.totalOrders,
        cancelledOrders: snapshot.cancelledOrders,
        avgOrderValuePaise: snapshot.avgOrderValuePaise,
        uniqueCustomers: snapshot.uniqueCustomers,
        repeatCustomers: snapshot.repeatCustomers,
        cancellationRatePct: snapshot.cancellationRatePct,
        paymentCompletionRatePct: snapshot.paymentCompletionRatePct,
        repeatCustomerRatePct: snapshot.repeatCustomerRatePct,
        topItems: snapshot.topItems,
        peakHours: snapshot.peakHours,
    };
};
const pctDelta = (current, previous) => {
    if (previous === 0 && current === 0)
        return 0;
    if (previous === 0)
        return 100;
    return Number((((current - previous) / previous) * 100).toFixed(1));
};
const getAnalyticsOverview = async (params) => {
    if (!(params.start instanceof Date) || Number.isNaN(params.start.getTime())) {
        throw new Error('Invalid analytics start date');
    }
    if (!(params.end instanceof Date) || Number.isNaN(params.end.getTime())) {
        throw new Error('Invalid analytics end date');
    }
    if (params.end <= params.start) {
        throw new Error('Analytics end date must be after start date');
    }
    const rangeMs = params.end.getTime() - params.start.getTime();
    const maxRangeMs = 90 * 24 * 60 * 60 * 1000;
    if (rangeMs > maxRangeMs) {
        throw new Error('Analytics range cannot exceed 90 days');
    }
    const previousEnd = new Date(params.start);
    const previousStart = new Date(params.start.getTime() - rangeMs);
    const [current, previous] = await Promise.all([
        computeRangeMetrics({
            restaurantId: params.restaurantId,
            start: params.start,
            end: params.end,
        }),
        computeRangeMetrics({
            restaurantId: params.restaurantId,
            start: previousStart,
            end: previousEnd,
        }),
    ]);
    return {
        period: {
            start: params.start,
            end: params.end,
            previousStart,
            previousEnd,
            days: Math.max(1, Math.round(rangeMs / (24 * 60 * 60 * 1000))),
        },
        summary: current,
        deltas: {
            revenuePct: pctDelta(current.revenuePaise, previous.revenuePaise),
            completedOrdersPct: pctDelta(current.completedOrders, previous.completedOrders),
            avgOrderValuePct: pctDelta(current.avgOrderValuePaise, previous.avgOrderValuePaise),
            uniqueCustomersPct: pctDelta(current.uniqueCustomers, previous.uniqueCustomers),
            repeatCustomerRatePct: pctDelta(current.repeatCustomerRatePct, previous.repeatCustomerRatePct),
        },
        previous,
    };
};
exports.getAnalyticsOverview = getAnalyticsOverview;
//# sourceMappingURL=analytics.service.js.map