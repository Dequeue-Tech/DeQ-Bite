'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ChefHat, Mail } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

export default function ForgotPasswordPage() {
  const { sendPasswordReset, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    clearError();

    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch {
      // Error surfaced by store.
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Reset Password</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Enter your email to receive a reset link
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {sent ? (
          <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2.5 rounded-lg mb-4 text-sm">
            Reset email sent. Check your inbox and spam folder.
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {isSubmitting ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/auth/signin" className="text-orange-600 hover:text-orange-700 text-sm font-medium">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

