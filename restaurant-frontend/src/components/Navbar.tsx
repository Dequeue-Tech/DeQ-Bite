'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import { ChefHat, ShoppingCart, Home, UtensilsCrossed, ClipboardList, User, Settings, LogOut } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { apiClient } from '@/lib/api-client';

const Navbar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, logout, getProfile } = useAuthStore();
  const { getTotalItems } = useCartStore();
  const cartItemsCount = getTotalItems();
  const canAccessAdmin = user?.restaurantRole === 'OWNER' || user?.restaurantRole === 'ADMIN';
  const canAccessKitchen = canAccessAdmin || user?.restaurantRole === 'STAFF';
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user && typeof user.restaurantRole === 'undefined') {
      getProfile();
    }
  }, [isAuthenticated, user, getProfile]);

  const handleLogout = () => {
    logout();
    setShowUserDropdown(false);
    router.push('/auth/signin');
  };

  const selectedRestaurantSlug = apiClient.getSelectedRestaurantSlug();
  const activeRestaurantSlug = apiClient.getActiveRestaurantSlug();
  const withRestaurant = (path: string) => {
    if (!activeRestaurantSlug) return path;
    return `/r/${activeRestaurantSlug}${path.startsWith('/') ? path : `/${path}`}`;
  };

  // Desktop navigation links
  const desktopNavLinks = [
    { name: 'Home', href: '/' },
    { name: 'Menu', href: withRestaurant('/menu') },
    ...(isAuthenticated ? [
      { name: 'Orders', href: withRestaurant('/orders') },
      ...(canAccessAdmin ? [{name: 'Central Admin', href: withRestaurant('/central-admin')}]:[]),
      ...(canAccessAdmin ? [{ name: 'Admin', href: withRestaurant('/admin') }] : []),
      ...(canAccessKitchen ? [{ name: 'Kitchen', href: withRestaurant('/kitchen') }] : []),
    ] : []),
  ];

  // Mobile bottom navigation links (max 4 items, profile is in top nav)
  const mobileNavLinks = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Menu', href: withRestaurant('/menu'), icon: UtensilsCrossed },
    ...(isAuthenticated ? [
      { name: 'Orders', href: withRestaurant('/orders'), icon: ClipboardList },
    ] : []),
    { name: 'Cart', href: withRestaurant('/cart'), icon: ShoppingCart, badge: cartItemsCount },
  ].slice(0, 4); // Max 4 items since profile is in top nav

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16">
            {/* Logo and brand */}
            <div className="flex items-center min-w-0">
              <Link href="/" className="flex items-center min-w-0">
                <ChefHat className="h-7 w-7 sm:h-8 sm:w-8 text-orange-600 mr-1.5 sm:mr-2 flex-shrink-0" />
                <span className="text-lg sm:text-xl font-bold text-gray-800 truncate">Restaurant</span>
                {selectedRestaurantSlug && (
                  <span className="hidden sm:inline ml-1.5 sm:ml-2 text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-orange-100 text-orange-700 truncate max-w-[80px] sm:max-w-[120px]">
                    @{selectedRestaurantSlug}
                  </span>
                )}
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
              {desktopNavLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`text-sm lg:text-base ${
                    pathname === link.href
                      ? 'text-orange-600 font-medium'
                      : 'text-gray-600 hover:text-orange-600'
                  } transition-colors`}
                >
                  {link.name}
                </Link>
              ))}

              {/* Cart icon for authenticated users */}
              {isAuthenticated && (
                <Link href={withRestaurant('/cart')} className="relative p-2 -m-2">
                  <ShoppingCart className="h-5 w-5 lg:h-6 lg:w-6 text-gray-600 hover:text-orange-600 transition-colors" />
                  {cartItemsCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center text-[10px] sm:text-xs">
                      {cartItemsCount > 9 ? '9+' : cartItemsCount}
                    </span>
                  )}
                </Link>
              )}

              {/* Auth actions */}
              {isAuthenticated ? (
                <div className="flex items-center space-x-3 lg:space-x-4">
                  <span className="text-gray-600 text-xs lg:text-sm truncate max-w-[100px] lg:max-w-[150px]">Welcome, {user?.name}</span>
                  <button
                    onClick={handleLogout}
                    className="text-gray-600 hover:text-gray-800 transition-colors text-sm lg:text-base"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-3 lg:space-x-4">
                  <Link
                    href="/auth/signin"
                    className="text-orange-600 hover:text-orange-700 transition-colors text-sm lg:text-base"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="bg-orange-600 text-white px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm lg:text-base"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile: Profile icon with dropdown */}
            {isAuthenticated ? (
              <Link 
                href={withRestaurant('/orders')} 
                className="md:hidden flex items-center p-2 text-gray-600 hover:text-orange-600 active:bg-gray-100 rounded-lg transition-colors"
              >
                <User className="h-6 w-6" />
              </Link>
            ) : (
              <Link 
                href="/auth/signin" 
                className="md:hidden flex items-center p-2 text-orange-600 hover:text-orange-700 active:bg-gray-50 rounded-lg transition-colors"
              >
                <User className="h-6 w-6" />
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-pb">
        <div className="flex justify-around items-center h-16">
          {mobileNavLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 ${
                  active
                    ? 'text-orange-600'
                    : 'text-gray-500 hover:text-gray-700'
                } transition-colors active:bg-gray-50`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  {typeof link.badge === 'number' && link.badge > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                      {link.badge > 9 ? '9+' : link.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] sm:text-xs mt-0.5 truncate max-w-[60px]">
                  {link.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default Navbar;
