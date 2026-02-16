import { AppError } from '@/middleware/errorHandler';
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  fetchPaymentDetails,
  refundRazorpayPayment,
} from '@/lib/razorpay';

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
  verifyPayment: (input: VerifyPaymentInput) => Promise<{ status: 'authorized' | 'captured' }>;
  refund: (paymentId: string, amountPaise?: number, reason?: string) => Promise<any>;
}

const razorpayProvider: PaymentProvider = {
  provider: 'RAZORPAY',
  isEnabled: () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  createOrder: async (input) => {
    if (!razorpayProvider.isEnabled()) {
      throw new AppError('Razorpay is not configured', 400);
    }
    const order = await createRazorpayOrder({
      amountPaise: input.amountPaise,
      receipt: input.receipt,
      notes: input.notes,
    });
    return {
      provider: 'RAZORPAY',
      paymentOrderId: order.id,
      amountPaise: order.amount,
      currency: 'INR',
      publicKey: process.env.RAZORPAY_KEY_ID,
    };
  },
  verifyPayment: async (input) => {
    if (!input.razorpay_order_id || !input.razorpay_payment_id || !input.razorpay_signature) {
      throw new AppError('Missing Razorpay verification fields', 400);
    }
    const isValid = verifyRazorpaySignature(
      input.razorpay_order_id,
      input.razorpay_payment_id,
      input.razorpay_signature
    );
    if (!isValid) {
      throw new AppError('Invalid payment signature', 400);
    }
    const paymentDetails = await fetchPaymentDetails(input.razorpay_payment_id);
    if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
      throw new AppError(`Payment not successful. Status: ${paymentDetails.status}`, 400);
    }
    return { status: paymentDetails.status as 'authorized' | 'captured' };
  },
  refund: async (paymentId, amountPaise, reason) => {
    return refundRazorpayPayment(paymentId, amountPaise, reason);
  },
};

const paytmProvider: PaymentProvider = {
  provider: 'PAYTM',
  isEnabled: () => Boolean(process.env.PAYTM_MERCHANT_ID && process.env.PAYTM_MERCHANT_KEY),
  createOrder: async () => {
    throw new AppError('Paytm integration is not configured in this build', 501);
  },
  verifyPayment: async () => {
    throw new AppError('Paytm integration is not configured in this build', 501);
  },
  refund: async () => {
    throw new AppError('Paytm integration is not configured in this build', 501);
  },
};

const phonepeProvider: PaymentProvider = {
  provider: 'PHONEPE',
  isEnabled: () => Boolean(process.env.PHONEPE_MERCHANT_ID && process.env.PHONEPE_SALT_KEY),
  createOrder: async () => {
    throw new AppError('PhonePe integration is not configured in this build', 501);
  },
  verifyPayment: async () => {
    throw new AppError('PhonePe integration is not configured in this build', 501);
  },
  refund: async () => {
    throw new AppError('PhonePe integration is not configured in this build', 501);
  },
};

const providers: Record<PaymentProviderType, PaymentProvider> = {
  RAZORPAY: razorpayProvider,
  PAYTM: paytmProvider,
  PHONEPE: phonepeProvider,
};

export const getPaymentProvider = (provider: PaymentProviderType) => providers[provider];

export const getEnabledProviders = () => {
  return Object.values(providers)
    .filter((provider) => provider.isEnabled())
    .map((provider) => provider.provider);
};
