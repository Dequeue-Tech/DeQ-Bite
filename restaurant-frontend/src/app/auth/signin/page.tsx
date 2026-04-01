'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { ChefHat, Github, Lock, Mail, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '@/lib/firebase';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';

type AuthTab = 'EMAIL' | 'PHONE';

const normalizePhoneNumber = (rawPhone: string) => {
  const cleaned = rawPhone.trim().replace(/[\s()-]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^91\d{10}$/.test(cleaned)) return `+${cleaned}`;
  if (/^\d+$/.test(cleaned)) return `+${cleaned}`;
  return cleaned;
};

export default function SignInPage() {
  const router = useRouter();
  const { login, loginWithOAuth, syncFirebaseUser, error, clearError } = useAuthStore();

  const [authTab, setAuthTab] = useState<AuthTab>('EMAIL');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState<'REQUEST' | 'VERIFY'>('REQUEST');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const normalizedPhoneRef = useRef<string>('');

  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  const afterAuthNavigate = async () => {
    const authUser = useAuthStore.getState().user;
    const hasAdminAccess =
      authUser?.role === 'OWNER' ||
      authUser?.role === 'ADMIN' ||
      authUser?.restaurantRole === 'OWNER' ||
      authUser?.restaurantRole === 'ADMIN';
    const hasStaffDashAccess =
      authUser?.role === 'STAFF' ||
      authUser?.restaurantRole === 'STAFF';

    const selectedRestaurantSlug = apiClient.getSelectedRestaurantSlug();
    if (!hasAdminAccess && !hasStaffDashAccess) {
      router.push(selectedRestaurantSlug ? `/${selectedRestaurantSlug}` : '/');
      return;
    }

    if (selectedRestaurantSlug) {
      router.replace(`/${selectedRestaurantSlug}/admin`);
      return;
    }

    try {
      const restaurants = await apiClient.getMyRestaurants();
      const dashboardRestaurant = restaurants.find(
        (restaurant) =>
          restaurant.role === 'OWNER' ||
          restaurant.role === 'ADMIN' ||
          restaurant.role === 'STAFF'
      );
      const resolvedSlug = dashboardRestaurant?.slug || dashboardRestaurant?.subdomain || dashboardRestaurant?.id;
      if (resolvedSlug) {
        apiClient.setSelectedRestaurantSlug(resolvedSlug);
        router.replace(`/${resolvedSlug}/admin`);
        return;
      }
    } catch {
      // ignore errors while trying to resolve admin restaurant
    }

    router.replace('/admin');
  };

  const getRecaptchaVerifier = () => {
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }

    const verifier = new RecaptchaVerifier(auth, 'phone-recaptcha-container', {
      size: 'invisible',
    });

    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const handleEmailSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    clearError();

    try {
      await login({ email, password });
      await afterAuthNavigate();
    } catch {
      // Errors are surfaced from the auth store.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'GOOGLE' | 'GITHUB') => {
    setIsSubmitting(true);
    clearError();

    try {
      await loginWithOAuth(provider);
      await afterAuthNavigate();
    } catch {
      // Errors are surfaced from the auth store.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    clearError();

    try {
      const normalizedPhone = normalizePhoneNumber(phone);
      if (!normalizedPhone || normalizedPhone.length < 11) {
        throw new Error('Enter a valid phone number with country code');
      }

      const verifier = getRecaptchaVerifier();
      const confirmationResult = await apiClient.startPhoneOtp(normalizedPhone, verifier);
      confirmationResultRef.current = confirmationResult;
      normalizedPhoneRef.current = normalizedPhone;
      setOtpStep('VERIFY');
      toast.success('OTP sent successfully');
    } catch (otpError) {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
      const message = otpError instanceof Error ? otpError.message : 'Failed to send OTP';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    clearError();

    try {
      if (!confirmationResultRef.current) {
        throw new Error('OTP session expired. Please request a new OTP.');
      }
      if (!otpCode.trim() || otpCode.trim().length < 6) {
        throw new Error('Enter the 6-digit OTP');
      }

      await confirmationResultRef.current.confirm(otpCode.trim());
      await syncFirebaseUser({
        phone: normalizedPhoneRef.current || normalizePhoneNumber(phone),
      });
      toast.success('Phone verification successful');
      await afterAuthNavigate();
    } catch (otpError) {
      const message = otpError instanceof Error ? otpError.message : 'Failed to verify OTP';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl p-5 sm:p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <ChefHat className="h-10 w-10 sm:h-12 sm:w-12 text-orange-600" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Welcome Back</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Sign in with your preferred method</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            type="button"
            onClick={() => {
              setAuthTab('EMAIL');
              setOtpStep('REQUEST');
            }}
            className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
              authTab === 'EMAIL' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthTab('PHONE');
              clearError();
            }}
            className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
              authTab === 'PHONE' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Phone OTP
          </button>
        </div>

        {authTab === 'EMAIL' ? (
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors text-sm"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors text-sm"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Link href="/auth/forgot-password" className="text-xs font-medium text-orange-600 hover:text-orange-700">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        ) : otpStep === 'REQUEST' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors text-sm"
                  placeholder="e.g. +919876543210 or 9876543210"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {isSubmitting ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-xs text-gray-600">
              OTP sent to <span className="font-semibold">{normalizedPhoneRef.current || normalizePhoneNumber(phone)}</span>
            </p>
            <div>
              <label htmlFor="otp" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                Enter OTP
              </label>
              <input
                id="otp"
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors text-sm tracking-widest"
                placeholder="6-digit OTP"
                maxLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {isSubmitting ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOtpStep('REQUEST');
                setOtpCode('');
                clearError();
              }}
              className="w-full text-sm text-gray-600 hover:text-gray-800"
            >
              Change phone number
            </button>
          </form>
        )}

        <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
          <div className="h-px bg-gray-200 flex-1" />
          <span>OR</span>
          <div className="h-px bg-gray-200 flex-1" />
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void handleOAuthSignIn('GOOGLE')}
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => void handleOAuthSignIn('GITHUB')}
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <Github className="h-4 w-4" />
            Continue with GitHub
          </button>
        </div>

        <div className="mt-5 text-center">
          <p className="text-gray-600 text-sm">
            Do not have an account?{' '}
            <Link href="/auth/signup" className="text-orange-600 hover:text-orange-700 font-medium">
              Sign up here
            </Link>
          </p>
        </div>

        <div className="mt-3 text-center">
          <Link href="/" className="text-gray-500 hover:text-gray-700 text-xs sm:text-sm transition-colors">
            Back to Home
          </Link>
        </div>

        <div id="phone-recaptcha-container" />
      </div>
    </div>
  );
}
