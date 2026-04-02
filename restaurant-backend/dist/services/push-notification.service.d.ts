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
    eventType: 'order.created' | 'order.accepted' | 'order.completed';
    orderId: string;
    status: string;
    title: string;
    body: string;
    url: string;
};
export declare const getPublicVapidKey: () => string;
export declare const upsertPushSubscription: (input: {
    restaurantId: string;
    userId: string;
    roleScope?: string;
    userAgent?: string;
    subscription: WebPushSubscriptionPayload;
}) => Promise<any>;
export declare const deactivatePushSubscription: (input: {
    restaurantId: string;
    userId: string;
    endpoint: string;
}) => Promise<any>;
export declare const notifyCriticalOrderPush: (input: CriticalOrderPushInput) => Promise<void>;
export {};
//# sourceMappingURL=push-notification.service.d.ts.map