'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EditorialMichelinSignInPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [greeting, setGreeting] = useState('Welcome');

  const [formData, setFormData] = useState({ email: '', password: '' });

  // Handle Hydration, Animations, and Time-based Greeting
  useEffect(() => {
    setIsMounted(true);
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning.');
    else if (hour < 18) setGreeting('Good afternoon.');
    else setGreeting('Good evening.');
  }, []);

  const handleEmailSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success('Welcome back!');
      router.push('/'); 
    } catch (error: any) {
      toast.error(error?.message || 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Google Sign In clicked!');
    } catch (error) {
      toast.error('Failed to sign in with Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  if (!isMounted) return null;

  const isFormDisabled = isLoading || isGoogleLoading;

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center relative overflow-hidden selection:bg-orange-500/30 font-sans">
      
      {/* --- Cinematic CSS Animations --- */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes subtle-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-subtle-spin {
          animation: subtle-spin 180s linear infinite;
        }
        
        /* Staggered form field reveals */
        @keyframes slide-up-fade {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .stagger-1 { animation: slide-up-fade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards; opacity: 0; }
        .stagger-2 { animation: slide-up-fade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards; opacity: 0; }
        .stagger-3 { animation: slide-up-fade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards; opacity: 0; }
        .stagger-4 { animation: slide-up-fade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards; opacity: 0; }
        .stagger-5 { animation: slide-up-fade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards; opacity: 0; }
        .stagger-6 { animation: slide-up-fade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.6s forwards; opacity: 0; }
      `}} />

      {/* --- The "Hero Plate" (Top Right) --- */}
      {/* Removed the thick white border and swapped to a high-end dark ceramic plated dish */}
      <div className="absolute -top-[15%] -right-[35%] sm:-top-[30%] sm:-right-[10%] w-[110vw] h-[110vw] sm:w-[800px] sm:h-[800px] rounded-full overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.08)] animate-subtle-spin pointer-events-none z-0">
        <img 
          src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80" 
          alt="Gourmet Dish" 
          className="w-full h-full object-cover scale-105" 
        />
      </div>

      {/* --- Subtle Blurred Depth Accent (Bottom Left) --- */}
      {/* Swapped to a subtle, classy top-down espresso cup */}
      <div className="absolute -bottom-[10%] -left-[20%] w-[50vw] h-[50vw] sm:w-[400px] sm:h-[400px] rounded-full overflow-hidden animate-subtle-spin blur-[6px] opacity-60 pointer-events-none z-0" style={{ animationDirection: 'reverse', animationDuration: '240s' }}>
        <img 
          src="https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80" 
          alt="Coffee Accent" 
          className="w-full h-full object-cover scale-110" 
        />
      </div>

      {/* --- Ambient Gradient Fade --- */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#FAF9F6] via-[#FAF9F6]/95 to-transparent pointer-events-none z-0" />

      {/* --- Main Content Container --- */}
      <div className="w-full max-w-sm z-10 px-8 sm:px-0 flex flex-col h-full justify-end sm:justify-center pb-12 sm:pb-0 mt-auto sm:mt-0">
        
        {/* Editorial Header */}
        <div className="mb-10 stagger-1">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-px bg-orange-600" />
            <span className="text-[10px] font-bold text-orange-600 tracking-[0.2em] uppercase">DeQ-Bite</span>
          </div>
          
          <h1 
            className="text-4xl sm:text-5xl font-normal text-gray-900 tracking-tight leading-[1.1] mb-3"
            style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
          >
            {greeting}
          </h1>
          <p className="text-gray-500 font-medium text-sm sm:text-base">
            Experience culinary excellence.
          </p>
        </div>

        {/* Google Sign In Button (Moved to Top) */}
        <div className="w-full mb-6 stagger-2">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isFormDisabled}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 rounded-full py-4 sm:py-4.5 font-bold text-sm hover:bg-gray-50 active:scale-[0.98] shadow-[0_4px_14px_rgba(0,0,0,0.03)] transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            {isGoogleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6 stagger-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Or sign in with email</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailSignIn} className="space-y-6 w-full relative z-10">
          
          {/* Flushed Input: Email */}
          <div className="relative group stagger-4">
            <input
              id="email"
              type="email"
              placeholder=" "
              required
              disabled={isFormDisabled}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="peer w-full bg-transparent border-b-2 border-gray-200 py-3 text-base font-medium text-gray-900 focus:border-gray-900 transition-colors outline-none rounded-none disabled:opacity-50"
            />
            <label 
              htmlFor="email" 
              className="absolute left-0 text-gray-400 text-base font-medium transition-all duration-300 origin-left peer-placeholder-shown:top-3 peer-placeholder-shown:scale-100 peer-focus:-top-4 peer-focus:scale-75 peer-focus:text-gray-900 -top-4 scale-75 pointer-events-none"
            >
              Email Address
            </label>
          </div>

          {/* Flushed Input: Password */}
          <div className="relative group stagger-5">
            <input
              id="password"
              type="password"
              placeholder=" "
              required
              disabled={isFormDisabled}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="peer w-full bg-transparent border-b-2 border-gray-200 py-3 text-base font-medium text-gray-900 focus:border-gray-900 transition-colors outline-none rounded-none disabled:opacity-50"
            />
            <label 
              htmlFor="password" 
              className="absolute left-0 text-gray-400 text-base font-medium transition-all duration-300 origin-left peer-placeholder-shown:top-3 peer-placeholder-shown:scale-100 peer-focus:-top-4 peer-focus:scale-75 peer-focus:text-gray-900 -top-4 scale-75 pointer-events-none"
            >
              Password
            </label>
            
            <button type="button" disabled={isFormDisabled} className="absolute right-0 top-4 text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors bg-transparent disabled:opacity-50">
              Forgot?
            </button>
          </div>

          {/* Email Submit Button */}
          <div className="pt-2 stagger-6">
            <button
              type="submit"
              disabled={isFormDisabled}
              className="w-full relative group overflow-hidden bg-gray-900 text-white rounded-full py-4 sm:py-4.5 font-bold text-sm shadow-[0_10px_30px_rgba(0,0,0,0.1)] hover:bg-black active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Authenticating...</>
              ) : (
                <>
                  Sign In 
                  <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform duration-300" />
                </>
              )}
            </button>
          </div>
        </form>
        
        {/* Editorial Footer Links */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between text-xs font-bold text-gray-400 stagger-6">
          <Link href="/auth/signup" className="hover:text-gray-900 transition-colors uppercase tracking-wider">
            Create Account
          </Link>
          <Link href="#" className="hover:text-gray-900 transition-colors uppercase tracking-wider">
            Need Help?
          </Link>
        </div>

      </div>
    </div>
  );
}