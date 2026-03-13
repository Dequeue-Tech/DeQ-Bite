'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Star, MapPin, Banknote, Sparkles, Crown, GlassWater, ArrowRight } from 'lucide-react';
import { apiClient, Offer } from '@/lib/api-client';
import { formatInr } from '@/lib/currency';
import toast from 'react-hot-toast';

export default function RestaurantLandingPage() {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [currentOfferIndex, setCurrentOfferIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const run = async () => {
      const identifier = (id || slug || '').toString();
      if (!identifier) return;
      try {
        localStorage.setItem('selectedRestaurantSlug', identifier);
      } catch {}
      try {
        setLoading(true);
        // Fetch restaurant details
        const details = await apiClient.getRestaurantPublicDetails(identifier.toLowerCase());
        setRestaurant(details);
        
        // Fetch offers
        const offersData = await apiClient.getOffers();
        setOffers(offersData);
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load restaurant');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [id, slug]);

  // Auto-rotate carousel every 3 seconds
  useEffect(() => {
    if (offers.length > 0) {
      const interval = setInterval(() => {
        setCurrentOfferIndex((prev) => (prev + 1) % offers.length);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [offers.length]);

  // Scroll carousel to current offer (only if user hasn't scrolled recently)
  useEffect(() => {
    if (carouselRef.current && offers.length > 0) {
      const cardWidth = carouselRef.current.offsetWidth;
      carouselRef.current.scrollTo({
        left: cardWidth * currentOfferIndex,
        behavior: 'smooth',
      });
    }
  }, [currentOfferIndex, offers.length]);

  const selectAndOpen = () => {
    const slugValue = restaurant?.slug || restaurant?.subdomain || restaurant?.id;
    if (!slugValue) return;
    router.push(`/${slugValue}/menu`);
  };
  
  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word: string) => word[0]?.toUpperCase() || '')
      .join('');
  
  // Calculate price for two from menu items
  const getPriceForTwo = () => {
    if (!restaurant?.menuItems || restaurant.menuItems.length === 0) return '₹800';
    const avgPrice = restaurant.menuItems.reduce((sum: number, item: any) => sum + item.pricePaise, 0) / restaurant.menuItems.length;
    return formatInr(Math.round(avgPrice * 2));
  };
  
  // Get cuisine types
  const getCuisineTypes = () => {
    if (!restaurant?.cuisineTypes || restaurant.cuisineTypes.length === 0) return 'Multi-cuisine';
    return restaurant.cuisineTypes.slice(0, 2).join(', ');
  };
  
  // Map offers to design types based on offer properties
  const getOfferDesignType = (offer: Offer, index: number) => {
    const designs = ['modern_cashback', 'premium_gold', 'minimalist_glass'] as const;
    return designs[index % 3];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-orange-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading restaurant...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p className="text-gray-700 text-center">Restaurant not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Hero Section with Dark Overlay */}
      <div className="relative h-64 sm:h-80 w-full overflow-hidden">
        {(restaurant.backgroundImage || restaurant.logo) ? (
          <>
            <Image
              src={restaurant.backgroundImage || restaurant.logo}
              alt={restaurant.name}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-transparent" />
          </>
        ) : (
          <>
            <Image
              src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1470&auto=format&fit=crop"
              alt="Restaurant ambiance"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-transparent" />
          </>
        )}
      </div>

      {/* Floating Card overlapping hero image */}
      <div className="relative -mt-8 sm:-mt-12 z-10 px-3 sm:px-4 pb-6">
        <div className="bg-white rounded-t-[32px] shadow-2xl overflow-hidden">
          {/* Main Content Container */}
          <div className="p-5 sm:p-6">
            {/* Title Row with Rating Badge */}
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                {restaurant.name}
              </h1>
              {restaurant.rating && (
                <div className="flex items-center gap-1.5 bg-green-900 text-white px-3 py-1.5 rounded-lg shadow-md">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="text-sm font-bold">{restaurant.rating}</span>
                </div>
              )}
            </div>

            {/* Distance & Location Row */}
            {(restaurant.address || restaurant.city) && (
              <div className="flex items-center gap-2 mb-2 text-orange-600">
                <span className="text-sm font-medium">
                  {restaurant.address || `${restaurant.city || ''}${restaurant.state ? ', ' + restaurant.state : ''}`}
                </span>
              </div>
            )}

            {/* Cuisine & Price Row */}
            <div className="flex items-center gap-4 text-gray-500 text-sm mb-4">
              <span>{getCuisineTypes()}</span>
              <span className="w-1 h-1 bg-gray-300 rounded-full" />
              <span>{getPriceForTwo()} for two</span>
            </div>

            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-4 py-2 mb-6">
              <span className="text-sm font-medium text-red-700">
                {restaurant.status === 'APPROVED' ? 'Open Now' : 'Closed'}
              </span>
            </div>

            {/* Multi-Variant Offer Carousel */}
            {offers.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Offers for you</h2>
                
                <div
                  ref={carouselRef}
                  className="flex overflow-x-scroll gap-4 snap-x snap-mandatory scrollbar-hide"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  onScroll={(e) => {
                    // Update index based on scroll position when user scrolls
                    const scrollLeft = e.currentTarget.scrollLeft;
                    const cardWidth = carouselRef.current?.offsetWidth || 0;
                    const newIndex = Math.round(scrollLeft / cardWidth);
                    if (newIndex !== currentOfferIndex && newIndex >= 0 && newIndex < offers.length) {
                      setCurrentOfferIndex(newIndex);
                    }
                  }}
                >
                  <style jsx global>{`
                    .scrollbar-hide::-webkit-scrollbar {
                      display: none;
                    }
                    .scrollbar-hide {
                      -ms-overflow-style: none;
                      scrollbar-width: none;
                    }
                  `}</style>

                  {offers.map((offer, index) => {
                    const designType = getOfferDesignType(offer, index);
                    
                    return (
                      <div
                        key={offer.id}
                        className="snap-center shrink-0 w-72 h-40 rounded-2xl p-5 relative overflow-hidden transition-all duration-500"
                      >
                        {/* Style 1: Modern Cashback */}
                        {designType === 'modern_cashback' && (
                          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 to-emerald-600">
                            <div className="absolute top-2 right-4 text-8xl font-black text-white/5 select-none">
                              %
                            </div>
                            <Banknote className="absolute top-8 left-8 h-6 w-6 text-white/10 rotate-12" />
                            <Banknote className="absolute bottom-12 right-16 h-5 w-5 text-white/10 -rotate-6" />
                            <Banknote className="absolute top-1/2 left-3/4 h-4 w-4 text-white/10 rotate-45" />
                          </div>
                        )}

                        {/* Style 2: Premium Gold */}
                        {designType === 'premium_gold' && (
                          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-yellow-600/50">
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent animate-pulse" />
                            <div className="absolute top-3 right-3 bg-yellow-600 text-black px-2 py-1 rounded-md flex items-center gap-1">
                              <Crown className="h-3 w-3" />
                              <span className="text-xs font-bold">PRO</span>
                            </div>
                          </div>
                        )}

                        {/* Style 3: Minimalist Glass */}
                        {designType === 'minimalist_glass' && (
                          <div className="absolute inset-0 bg-white/60 backdrop-blur-md border border-white/20">
                            <GlassWater className="absolute top-4 right-4 h-8 w-8 text-blue-400/20" />
                          </div>
                        )}

                        {/* Card Content */}
                        <div className="relative z-10 h-full flex flex-col justify-center">
                          <h3 className="text-2xl sm:text-3xl font-black text-white mb-1 drop-shadow-lg">
                            {offer.discountType === 'PERCENT' ? `${offer.value}% OFF` : `₹${offer.value / 100} OFF`}
                          </h3>
                          <p className="text-sm text-white/90 font-medium drop-shadow">
                            {offer.description || offer.name}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Carousel Indicators */}
                <div className="flex justify-center gap-2 mt-4">
                  {offers.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentOfferIndex(index)}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        index === currentOfferIndex
                          ? 'w-8 bg-orange-600'
                          : 'w-2 bg-gray-300'
                      }`}
                      aria-label={`Go to offer ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pre-booking Offers Section */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                More deals for you
              </h3>
              <div className="flex flex-wrap gap-2">
                {['Pre-booking offers', 'Early bird discount', 'Weekend special', 'Flat ₹100 OFF'].map(
                  (badge) => (
                    <button
                      key={badge}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-full transition-colors"
                    >
                      {badge}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={selectAndOpen}
              className="w-full bg-orange-600 text-white py-4 rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 font-bold text-lg flex items-center justify-center gap-2"
            >
              View Menu & Order
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="relative mx-3 my-6 rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-md mb-24">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-orange-500/10 blur-3xl" />

        <div className="relative flex flex-col items-center text-center">
          <h1 className="text-2xl font-black tracking-tighter text-gray-900 sm:text-3xl">
            <span className="text-orange-600">#</span>Bite
          </h1>

          <div className="my-2 flex items-center gap-2">
            <div className="h-[1px] w-4 bg-gray-300" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 sm:text-xs">
              Product of Dequeue
            </h2>
            <div className="h-[1px] w-4 bg-gray-300" />
          </div>

          <h3 className="max-w-[250px] text-[8px] leading-relaxed text-gray-400 sm:text-[10px]">
            Terms and conditions applied <br />
            <span className="font-semibold uppercase">
              Dequeue Retail Technologies Pvt Ltd.
            </span>
          </h3>
        </div>
      </div>
    </div>
  );
}
