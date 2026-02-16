import Razorpay from 'razorpay';
declare function getRazorpayInstance(): Razorpay;
export declare const razorpay: typeof getRazorpayInstance;
export interface RazorpayOrderOptions {
    amountPaise: number;
    currency?: string;
    receipt: string;
    notes?: Record<string, string>;
}
export declare function createRazorpayOrder(options: RazorpayOrderOptions): Promise<import("razorpay/dist/types/orders").Orders.RazorpayOrder>;
export declare function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean;
export declare function captureRazorpayPayment(paymentId: string, amount: number): Promise<import("razorpay/dist/types/payments").Payments.RazorpayPayment>;
export declare function refundRazorpayPayment(paymentId: string, amountPaise?: number, reason?: string): Promise<import("razorpay/dist/types/refunds").Refunds.RazorpayRefund>;
export declare function fetchPaymentDetails(paymentId: string): Promise<import("razorpay/dist/types/payments").Payments.RazorpayPayment>;
export declare function validateWebhookSignature(body: string, signature: string, secret?: string): boolean;
export {};
//# sourceMappingURL=razorpay.d.ts.map