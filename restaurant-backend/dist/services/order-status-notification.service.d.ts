export declare const notifyOrderStatusChange: (input: {
    orderId: string;
    previousStatus: string;
    nextStatus: string;
    source: string;
}) => Promise<{
    emailSent: boolean;
    smsSent: boolean;
}>;
//# sourceMappingURL=order-status-notification.service.d.ts.map