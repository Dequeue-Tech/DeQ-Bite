"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("@/middleware/auth");
const restaurant_1 = require("@/middleware/restaurant");
const errorHandler_1 = require("@/middleware/errorHandler");
const push_notification_service_1 = require("@/services/push-notification.service");
const router = (0, express_1.Router)();
const subscriptionSchema = zod_1.z.object({
    endpoint: zod_1.z.string().url(),
    keys: zod_1.z.object({
        p256dh: zod_1.z.string().min(1),
        auth: zod_1.z.string().min(1),
    }),
});
const subscribeSchema = zod_1.z.object({
    roleScope: zod_1.z.enum(['admin', 'staff', 'customer', 'rider']).optional(),
    subscription: subscriptionSchema,
});
const unsubscribeSchema = zod_1.z.object({
    endpoint: zod_1.z.string().url(),
});
router.get('/vapid-public-key', auth_1.authenticate, restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const publicKey = (0, push_notification_service_1.getPublicVapidKey)();
    if (!publicKey) {
        throw new errorHandler_1.AppError('Push notification key is not configured', 503);
    }
    return res.json({
        success: true,
        data: { publicKey },
    });
}));
router.post('/subscribe', auth_1.authenticate, restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user?.id)
        throw new errorHandler_1.AppError('Unauthorized', 401);
    const payload = subscribeSchema.parse(req.body);
    const record = await (0, push_notification_service_1.upsertPushSubscription)({
        restaurantId: req.restaurant.id,
        userId: req.user.id,
        ...(payload.roleScope ? { roleScope: payload.roleScope } : {}),
        userAgent: req.get('user-agent') || '',
        subscription: payload.subscription,
    });
    return res.status(201).json({
        success: true,
        message: 'Push subscription saved',
        data: { id: record.id, roleScope: record.roleScope },
    });
}));
router.delete('/unsubscribe', auth_1.authenticate, restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user?.id)
        throw new errorHandler_1.AppError('Unauthorized', 401);
    const payload = unsubscribeSchema.parse(req.body);
    await (0, push_notification_service_1.deactivatePushSubscription)({
        restaurantId: req.restaurant.id,
        userId: req.user.id,
        endpoint: payload.endpoint,
    });
    return res.json({
        success: true,
        message: 'Push subscription removed',
    });
}));
exports.default = router;
//# sourceMappingURL=push.js.map