'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';
import { CreditCard, Shield, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { formatInr } from '@/lib/currency';

declare global {
  interface Window {
    Razorpay: {
      new (options: RazorpayOptions): {
        open: () => void;
      };
    };
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;  
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: {
    name?: string;
    email?: string;
  };
  theme: {
    color: string;
  };
  modal: {
    ondismiss: () => void;
  };
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface Order {
  id: string;
  totalPaise: number;
  subtotalPaise: number;
  taxPaise: number;
  discountPaise: number;
  paymentProvider?: 'RAZORPAY' | 'PAYTM' | 'PHONEPE' | 'CASH';
  table: {
    number: number;
    location: string;
  };
  items: {
    quantity: number;
    pricePaise: number;
    menuItem: {
      name: string;
    };
  }[];
}

interface SecurePaymentProcessorProps {
  order: Order;
  onPaymentSuccess: () => void;
  onPaymentError: (error: string) => void;
}

export default function SecurePaymentProcessor({ 
  order, 
  onPaymentSuccess, 
  onPaymentError 
}: SecurePaymentProcessorProps) {
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'failed'>('idle');
  const router = useRouter();
  const { user } = useAuthStore();

  const initiateSecurePayment = async () => {
    if (!order || !user) return;

    setPaymentLoading(true);
    setVerificationStatus('idle');

    try {
      if (order.paymentProvider === 'CASH') {
        throw new Error('Cash payments are confirmed by restaurant admin/manager');
      }
      // Create secure payment order via our backend API
      const paymentData = await apiClient.createPayment(order.id, (order.paymentProvider || 'RAZORPAY') as 'RAZORPAY' | 'PAYTM' | 'PHONEPE');

      if (paymentData.provider && paymentData.provider !== 'RAZORPAY') {
        if (paymentData.redirectUrl) {
          window.location.href = paymentData.redirectUrl;
          return;
        }
        throw new Error(`${paymentData.provider} is not configured for web checkout`);
      }

      // Load Razorpay script if not already loaded
      if (!window.Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        
        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      // Configure Razorpay with secure options
      const razorpayOptions: RazorpayOptions = {
        key: paymentData.publicKey,
        amount: paymentData.amountPaise,
        currency: paymentData.currency,
        name: process.env.NEXT_PUBLIC_APP_NAME || 'Restaurant Online Ordering',
        description: `Order #${order.id.substring(0, 8).toUpperCase()}`,
        order_id: paymentData.paymentOrderId,
        handler: async (paymentResponse: RazorpayResponse) => {
          await handlePaymentSuccess(paymentResponse);
        },
        prefill: {
          name: paymentData.customerDetails?.name || user.name,
          email: paymentData.customerDetails?.email || user.email,
        },
        theme: {
          color: '#ea580c', // Orange color
        },
        modal: {
          ondismiss: () => {
            setPaymentLoading(false);
            onPaymentError('Payment cancelled by user');
          },
        },
      };

      // Open Razorpay checkout
      const razorpay = new window.Razorpay(razorpayOptions);
      razorpay.open();
    } catch (error) {
      console.error('Payment initiation error:', error);
      setPaymentLoading(false);
      onPaymentError(
        error instanceof Error ? error.message : 'Failed to initiate payment. Please try again.'
      );
    }
  };

  const handlePaymentSuccess = async (paymentResponse: RazorpayResponse) => {
    setVerificationStatus('verifying');

    // Set a timeout for the verification process
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Payment verification timed out. The server is taking too long to respond. Please check your internet connection and try again.'));
      }, 25000); // Reduced to 25 seconds timeout
    });

    try {
      // Race between verification and timeout
      const verificationResult = await Promise.race([
        apiClient.verifyPayment({
          razorpay_order_id: paymentResponse.razorpay_order_id,
          razorpay_payment_id: paymentResponse.razorpay_payment_id,
          razorpay_signature: paymentResponse.razorpay_signature,
        }),
        timeoutPromise
      ]);

      setVerificationStatus('success');
      setPaymentLoading(false);
      setPaymentSuccess(true);

      // Call onPaymentSuccess to transition to step 3
      setTimeout(() => {
        onPaymentSuccess();
      }, 1000);
    } catch (error) {
      console.error('Payment verification error:', error);
      setVerificationStatus('failed');
      setPaymentLoading(false);
      
      // Provide more specific error messages
      let errorMessage = 'Payment verification failed. Please contact support.';
      if (error instanceof Error) {
        if (error.message.includes('signature')) {
          errorMessage = 'Payment verification failed due to invalid signature. Please try again.';
        } else if (error.message.includes('not found')) {
          errorMessage = 'Order not found. Please contact support.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Payment verification timed out. The server is taking too long to respond. Please check your internet connection and try again, or contact support if the issue persists.';
        } else if (error.message.includes('successful')) {
          errorMessage = 'Payment was not successful. Please check your payment method and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      onPaymentError(errorMessage);
    }
  };

  const getPaymentStatusIcon = () => {
    switch (verificationStatus) {
      case 'verifying':
        return <Clock className="h-6 w-6 text-blue-600 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-6 w-6 text-red-600" />;
      default:
        return null;
    }
  };

  const getVerificationMessage = () => {
    switch (verificationStatus) {
      case 'verifying':
        return 'Verifying payment security... This may take a few moments.';
      case 'success':
        return 'Payment verified successfully!';
      case 'failed':
        return 'Payment verification failed. Please try again or contact support.';
      default:
        return '';
    }
  };

  // Show success message when verification is successful but before transitioning
  if (verificationStatus === 'success' && paymentSuccess) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 text-center">
        <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-green-600 mx-auto mb-3 sm:mb-4" />
        <h2 className="text-xl sm:text-2xl font-bold text-green-800 mb-2">Payment Successful!</h2>
        <p className="text-sm sm:text-base text-gray-600 mb-4">
          Your order has been confirmed and you'll be redirected shortly.
        </p>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mb-4">
          <p className="text-green-800 font-medium text-sm sm:text-base">Order Details:</p>
          <p className="text-green-700 text-sm sm:text-base">Order ID: #{order.id.substring(0, 8).toUpperCase()}</p>
          <p className="text-green-700 text-sm sm:text-base">Amount: {formatInr(order.totalPaise)}</p>
          <p className="text-green-700 text-sm sm:text-base">Table: {order.table.number}</p>
        </div>
        <div className="flex justify-center">
          <button
            onClick={() => onPaymentSuccess()}
            className="bg-orange-600 text-white py-2.5 sm:py-2 px-4 sm:px-6 rounded-lg hover:bg-orange-700 transition-colors text-sm sm:text-base w-full sm:w-auto"
          >
            Continue to Order Summary
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold mb-4">Secure Payment</h2>
      
      {/* Security Features */}
      <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
        <div className="flex items-start sm:items-center p-3 sm:p-4 border border-green-200 rounded-lg bg-green-50">
          <Shield className="h-5 w-5 text-green-600 mr-2 sm:mr-3 flex-shrink-0 mt-0.5 sm:mt-0" />
          <div className="min-w-0">
            <p className="font-medium text-green-900 text-sm sm:text-base">Bank-Grade Security</p>
            <p className="text-xs sm:text-sm text-green-700">Your payment is secured by Razorpay with end-to-end encryption</p>
          </div>
        </div>

        <div className="flex items-start sm:items-center p-3 sm:p-4 border border-blue-200 rounded-lg bg-blue-50">
          <CreditCard className="h-5 w-5 text-blue-600 mr-2 sm:mr-3 flex-shrink-0 mt-0.5 sm:mt-0" />
          <div className="min-w-0">
            <p className="font-medium text-blue-900 text-sm sm:text-base">Multiple Payment Options</p>
            <p className="text-xs sm:text-sm text-blue-700">Credit/Debit Cards, UPI, Net Banking, and Wallets</p>
          </div>
        </div>

        {verificationStatus !== 'idle' && (
          <div className="flex items-start sm:items-center p-3 sm:p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex-shrink-0 mr-2 sm:mr-3 mt-0.5 sm:mt-0">
              {getPaymentStatusIcon()}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 text-sm sm:text-base">Payment Status</p>
              <p className="text-xs sm:text-sm text-gray-700">{getVerificationMessage()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Order Summary */}
      <div className="border-t pt-3 sm:pt-4 mb-4 sm:mb-6">
        <div className="flex justify-between items-center mb-2 text-sm sm:text-base">
          <span className="text-gray-600">Subtotal:</span>
          <span>{formatInr(order.subtotalPaise)}</span>
        </div>
        <div className="flex justify-between items-center mb-2 text-sm sm:text-base">
          <span className="text-gray-600">Discount:</span>
          <span className="text-green-600">- {formatInr(order.discountPaise)}</span>
        </div>
        <div className="flex justify-between items-center mb-2 text-sm sm:text-base">
          <span className="text-gray-600">Tax:</span>
          <span>{formatInr(order.taxPaise)}</span>
        </div>
        <div className="flex justify-between items-center text-base sm:text-lg font-bold border-t pt-2">
          <span>Total:</span>
          <span>{formatInr(order.totalPaise)}</span>
        </div>
      </div>

      {/* Payment Button */}
      <button
        onClick={initiateSecurePayment}
        disabled={paymentLoading || verificationStatus === 'verifying'}
        className={`w-full py-3 sm:py-3.5 px-4 rounded-lg font-medium transition-colors text-sm sm:text-base min-h-[48px] touch-manipulation ${
          paymentLoading || verificationStatus === 'verifying'
            ? 'bg-gray-400 cursor-not-allowed text-white'
            : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white'
        }`}
      >
        {paymentLoading || verificationStatus === 'verifying' ? (
          <div className="flex items-center justify-center">
            <Clock className="h-5 w-5 mr-2 animate-spin" />
            {verificationStatus === 'verifying' ? 'Verifying Payment...' : 'Processing...'}
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <CreditCard className="h-5 w-5 mr-2" />
            Pay Securely {formatInr(order.totalPaise)}
          </div>
        )}
      </button>

      {/* Security Notice */}
      <div className="mt-4 text-center text-xs sm:text-sm text-gray-500">
        <p>🔒 Your payment information is encrypted and secure</p>
        <p>Powered by Razorpay - PCI DSS Compliant</p>
      </div>
    </div>
  );
}
