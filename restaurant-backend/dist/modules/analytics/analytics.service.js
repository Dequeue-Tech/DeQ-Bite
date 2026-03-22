"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalyticsOverview = exports.generateAnalyticsSnapshot = void 0;
const database_1 = require("../../config/database");
const redis_1 = require("../../utils/redis");
const cacheTtlSeconds = 120;
const toIsoDate = (value) => value.toISOString().split('T')[0];
const getDailyBounds = (date) => {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
};
const getWeeklyBounds = (date) => {
    const day = date.getUTCDay() || 7;
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (day - 1));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
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
    const orders = (await database_1.prisma.order.findMany({
        where: {
            restaurantId,
            createdAt: {
                gte: start,
                lt: end,
            },
        },
        select: {
            id: true,
            totalPaise: true,
            status: true,
            paymentStatus: true,
            userId: true,
            createdAt: true,
            items: {
                select: {
                    quantity: true,
                    pricePaise: true,
                    menuItemId: true,
                    menuItem: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
        },
    }));
    const completedOrders = orders.filter((order) => order.status !== 'CANCELLED');
    const completedOrderCount = completedOrders.length;
    const totalOrders = orders.length;
    const cancelledOrders = totalOrders - completedOrderCount;
    const revenuePaise = completedOrders.reduce((acc, order) => acc + order.totalPaise, 0);
    const avgOrderValuePaise = completedOrderCount > 0 ? Math.round(revenuePaise / completedOrderCount) : 0;
    const uniqueCustomers = new Set(completedOrders.map((order) => order.userId)).size;
    const ordersByCustomer = new Map();
    completedOrders.forEach((order) => {
        ordersByCustomer.set(order.userId, (ordersByCustomer.get(order.userId) || 0) + 1);
    });
    const repeatCustomers = Array.from(ordersByCustomer.values()).filter((count) => count > 1).length;
    const paymentCompletedOrders = completedOrders.filter((order) => order.paymentStatus === 'COMPLETED').length;
    const cancellationRatePct = totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0;
    const paymentCompletionRatePct = completedOrderCount > 0 ? Math.round((paymentCompletedOrders / completedOrderCount) * 100) : 0;
    const repeatCustomerRatePct = uniqueCustomers > 0 ? Math.round((repeatCustomers / uniqueCustomers) * 100) : 0;
    const topItemsMap = new Map();
    const hourMap = new Map();
    for (const order of completedOrders) {
        const hour = order.createdAt.getUTCHours();
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
        for (const item of order.items) {
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
    }
    const topItems = Array.from(topItemsMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);
    const peakHours = Array.from(hourMap.entries())
        .map(([hour, ordersAtHour]) => ({ hour, orders: ordersAtHour }))
        .sort((a, b) => b.orders - a.orders)
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
            return JSON.parse(cached);
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