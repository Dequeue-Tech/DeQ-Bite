export type PaymentProviderType = 'RAZORPAY' | 'PAYTM' | 'PHONEPE';
export interface CreatePaymentInput {
    amountPaise: number;
    receipt: string;
    notes?: Record<string, string>;
}
export interface CreatePaymentResult {
    provider: PaymentProviderType;
    paymentOrderId: string;
    amountPaise: number;
    currency: 'INR';
    publicKey?: string;
    redirectUrl?: string;
}
export interface VerifyPaymentInput {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
}
export interface PaymentProvider {
    provider: PaymentProviderType;
    isEnabled: () => boolean;
    createOrder: (input: CreatePaymentInput) => Promise<CreatePaymentResult>;
    verifyPayment: (input: VerifyPaymentInput) => Promise<{
        status: 'authorized' | 'captured';
    }>;
    refund: (paymentId: string, amountPaise?: number, reason?: string) => Promise<any>;
}
export declare const getPaymentProvider: (provider: PaymentProviderType) => PaymentProvider;
export declare const getEnabledProviders: () => PaymentProviderType[];
//# sourceMappingURL=index.d.ts.map