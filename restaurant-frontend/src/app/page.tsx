'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import { ChefHat, ShoppingCart, Users, CreditCard, Clock, Shield } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      {/* Hero Section */}
      <section className="py-20">
        <div className="restaurant-container mx-auto px-6 text-center">
          <h2 className="text-5xl font-bold text-gray-800 mb-6">
            Delicious Food, <span className="text-orange-600">Delivered Fresh</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Experience authentic flavors with our secure online ordering system. 
            Order from our curated menu and enjoy table delivery with safe payment processing.
          </p>
          
          <div className="flex justify-center space-x-4">
            <Link
              href="/menu"
              className="bg-orange-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-orange-700 transition-colors flex items-center"
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Order Now
            </Link>
            <Link
              href="/menu"
              className="border-2 border-orange-600 text-orange-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-orange-600 hover:text-white transition-colors"
            >
              View Menu
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="restaurant-container mx-auto px-6">
          <h3 className="text-3xl font-bold text-center text-gray-800 mb-12">
            Why Choose Our Restaurant?
          </h3>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <ChefHat className="h-8 w-8 text-orange-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-800 mb-2">Fresh Ingredients</h4>
              <p className="text-gray-600">
                We use only the freshest, locally-sourced ingredients to create our delicious dishes.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-800 mb-2">Fast Service</h4>
              <p className="text-gray-600">
                Quick preparation and efficient table delivery to ensure your food arrives hot and fresh.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-orange-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-800 mb-2">Secure Payments</h4>
              <p className="text-gray-600">
                Bank-grade security with Razorpay integration for safe and reliable payment processing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-gray-50">
        <div className="restaurant-container mx-auto px-6">
          <h3 className="text-3xl font-bold text-center text-gray-800 mb-12">
            How It Works
          </h3>
          
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-orange-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Browse Menu</h4>
              <p className="text-gray-600 text-sm">
                Explore our diverse menu with detailed descriptions and pricing.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-orange-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Select Table</h4>
              <p className="text-gray-600 text-sm">
                Choose your preferred table location for delivery.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-orange-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Secure Payment</h4>
              <p className="text-gray-600 text-sm">
                Pay safely using our secure Razorpay payment gateway.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-orange-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                4
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Enjoy Food</h4>
              <p className="text-gray-600 text-sm">
                Receive your fresh, hot meal delivered to your table.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-orange-600">
        <div className="restaurant-container mx-auto px-6 text-center">
          <h3 className="text-3xl font-bold text-white mb-4">
            Ready to Order?
          </h3>
          <p className="text-orange-100 mb-8 text-lg">
            Join thousands of satisfied customers who trust our secure ordering system.
          </p>
          
          <Link
            href={isAuthenticated ? "/menu" : "/auth/signup"}
            className="bg-white text-orange-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center"
          >
            <Users className="h-5 w-5 mr-2" />
            {isAuthenticated ? "Order Now" : "Get Started"}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="restaurant-container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <ChefHat className="h-6 w-6 text-orange-600 mr-2" />
              <span className="text-xl font-bold">Restaurant Online Ordering</span>
            </div>
            
            <div className="text-gray-400">
              <p>&copy; 2024 Restaurant. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}