'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Star, MapPin, Banknote, Sparkles, Crown, GlassWater, ArrowRight } from 'lucide-react';
import { apiClient, Offer } from '@/lib/api-client';
import { formatInr } from '@/lib/currency';
import toast from 'react-hot-toast';

// --- Cache helpers ------------------------------------------------------------
const RESTAURANT_TTL = 10 * 60 * 1000; // 10 minutes
const OFFERS_TTL     =  5 * 60 * 1000; //  5 minutes

function cacheGet<T>(key: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    const ts  = localStorage.getItem(`${key}__ts`);
    if (!raw || !ts) return null;
    if (Date.now() - Number(ts) > ttl) {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}__ts`);
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function cacheSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem(`${key}__ts`, String(Date.now()));
  } catch {}
}

// --- Skeleton components -------------------------------------------------------
const HeroSkeleton = () => (
  <div className="h-64 sm:h-80 w-full bg-gray-200 animate-pulse" />
);

const CardSkeleton = () => (
  <div className="bg-white rounded-t-[32px] shadow-2xl overflow-hidden p-5 sm:p-6">
    {/* Title */}
    <div className="h-9 w-3/4 bg-gray-200 rounded-lg animate-pulse mb-3" />
    {/* Address */}
    <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse mb-2" />
    {/* Cuisine / price */}
    <div className="h-4 w-2/5 bg-gray-100 rounded animate-pulse mb-4" />
    {/* Status badge */}
    <div className="h-8 w-24 bg-gray-100 rounded-full animate-pulse mb-6" />
    {/* Offer cards */}
    <div className="h-40 bg-gray-100 rounded-2xl animate-pulse mb-6" />
    {/* Deal chips */}
    <div className="flex gap-2 mb-6">
      {[80, 96, 64, 72].map((w) => (
        <div key={w} className={`h-8 w-${w/4} bg-gray-100 rounded-full animate-pulse`} />
      ))}
    </div>
    {/* CTA */}
    <div className="h-14 w-full bg-orange-100 rounded-xl animate-pulse" />
  </div>
);

// --- Lazy-loaded offer carousel ------------------------------------------------
interface OfferCarouselProps {
  offers: Offer[];
  currentOfferIndex: number;
  setCurrentOfferIndex: (i: number) => void;
  carouselRef: React.RefObject<HTMLDivElement>;
}

const OfferCarousel = ({
  offers,
  currentOfferIndex,
  setCurrentOfferIndex,
  carouselRef,
}: OfferCarouselProps) => {
  const getOfferDesignType = (_offer: Offer, index: number) => {
    const designs = ['modern_cashback', 'premium_gold', 'minimalist_glass'] as const;
    return designs[index % 3];
  };

  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Offers for you</h2>

      <div
        ref={carouselRef}
        className="flex overflow-x-scroll gap-4 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onScroll={(e) => {
          const scrollLeft = e.currentTarget.scrollLeft;
          const cardWidth  = carouselRef.current?.offsetWidth || 0;
          const newIndex   = Math.round(scrollLeft / cardWidth);
          if (newIndex !== currentOfferIndex && newIndex >= 0 && newIndex < offers.length) {
            setCurrentOfferIndex(newIndex);
          }
        }}
      >
        <style jsx global>{`
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
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
                  <div className="absolute top-2 right-4 text-8xl font-black text-white/5 select-none">%</div>
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
                  {offer.discountType === 'PERCENT'
                    ? `${offer.value}% OFF`
                    : `?${offer.value / 100} OFF`}
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
              index === currentOfferIndex ? 'w-8 bg-orange-600' : 'w-2 bg-gray-300'
            }`}
            aria-label={`Go to offer ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

// --- Lazy image with blur-up placeholder --------------------------------------
interface LazyHeroImageProps {
  src: string;
  alt: string;
}

const LazyHeroImage = ({ src, alt }: LazyHeroImageProps) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {/* Low-quality placeholder shown until high-res loads */}
      {!loaded && (
        <div className="absolute inset-0 bg-gray-300 animate-pulse" />
      )}
      <Image
        src={src}
        alt={alt}
        fill
        className={`object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        // NOT priority — loads lazily (below-the-fold equivalent for progressive reveal)
        onLoad={() => setLoaded(true)}
        // Provide a tiny blurDataURL for the built-in Next.js blur placeholder
        placeholder="blur"
        blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
      />
    </>
  );
};

// --- Main component ------------------------------------------------------------
export default function RestaurantLandingPage() {
  const { id, slug }  = useParams<{ id?: string; slug?: string }>();
  const router        = useRouter();
  const [loading, setLoading]               = useState(true);
  const [restaurant, setRestaurant]         = useState<any>(null);
  const [offers, setOffers]                 = useState<Offer[]>([]);
  const [currentOfferIndex, setCurrentOfferIndex] = useState(0);
  const [heroImgLoaded, setHeroImgLoaded]   = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  // -- Data fetching with cache ------------------------------------------------
  useEffect(() => {
    const run = async () => {
      const identifier = (id || slug || '').toString();
      if (!identifier) return;

      try { apiClient.setSelectedRestaurantSlug(identifier); } catch {}

      // -- Restaurant details --
      const restaurantCacheKey = `restaurant_${identifier}`;
      const cachedRestaurant   = cacheGet<any>(restaurantCacheKey, RESTAURANT_TTL);

      if (cachedRestaurant) {
        // Show cached data immediately — no spinner
        setRestaurant(cachedRestaurant);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // -- Offers --
      const cachedOffers = cacheGet<Offer[]>('offers', OFFERS_TTL);
      if (cachedOffers) {
        setOffers(cachedOffers);
      }

      // -- Background refresh (stale-while-revalidate pattern) --
      try {
        const [details, offersData] = await Promise.all([
          cachedRestaurant ? null : apiClient.getRestaurantPublicDetails(identifier.toLowerCase()),
          cachedOffers     ? null : apiClient.getOffers(),
        ]);

        if (details) {
          setRestaurant(details);
          cacheSet(restaurantCacheKey, details);
        }
        if (offersData) {
          setOffers(offersData);
          cacheSet('offers', offersData);
        }
      } catch (error: any) {
        // Only show error if we have NO data to show
        if (!cachedRestaurant) {
          toast.error(error?.message || 'Failed to load restaurant');
        }
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [id, slug]);

  // -- Auto-rotate carousel ----------------------------------------------------
  useEffect(() => {
    if (offers.length === 0) return;
    const interval = setInterval(() => {
      setCurrentOfferIndex((prev) => (prev + 1) % offers.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [offers.length]);

  // -- Scroll carousel on index change ----------------------------------------
  useEffect(() => {
    if (!carouselRef.current || offers.length === 0) return;
    const cardWidth = carouselRef.current.offsetWidth;
    carouselRef.current.scrollTo({ left: cardWidth * currentOfferIndex, behavior: 'smooth' });
  }, [currentOfferIndex, offers.length]);

  // -- Helpers -----------------------------------------------------------------
  const selectAndOpen = useCallback(() => {
    const slugValue = restaurant?.slug || restaurant?.subdomain || restaurant?.id;
    if (!slugValue) return;
    router.push(`/${slugValue}/menu`);
  }, [restaurant, router]);

  const getPriceForTwo = useCallback(() => {
    if (!restaurant?.menuItems || restaurant.menuItems.length === 0) return '?800';
    const avg = restaurant.menuItems.reduce((s: number, i: any) => s + i.pricePaise, 0) / restaurant.menuItems.length;
    return formatInr(Math.round(avg * 2));
  }, [restaurant]);

  const getCuisineTypes = useCallback(() => {
    if (!restaurant?.cuisineTypes || restaurant.cuisineTypes.length === 0) return 'Multi-cuisine';
    return restaurant.cuisineTypes.slice(0, 2).join(', ');
  }, [restaurant]);

  // -- Hero image source -------------------------------------------------------
  const heroSrc = restaurant?.backgroundImage
    || restaurant?.logo
    || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1470&auto=format&fit=crop';

  // -- Render: full skeleton while first load ----------------------------------
  if (loading && !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 overflow-x-hidden">
        <HeroSkeleton />
        <div className="relative -mt-8 sm:-mt-12 z-10 px-3 sm:px-4 pb-6">
          <CardSkeleton />
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

  // -- Main render -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">

      {/* -- Hero Section --------------------------------------------------- */}
      <div className="relative h-64 sm:h-80 w-full overflow-hidden">
        {/* Skeleton shown until image finishes loading */}
        {!heroImgLoaded && (
          <div className="absolute inset-0 bg-gray-300 animate-pulse" />
        )}

        <Image
          src={heroSrc}
          alt={restaurant.name}
          fill
          className={`object-cover transition-opacity duration-700 ${heroImgLoaded ? 'opacity-100' : 'opacity-0'}`}
          // Hero is above-the-fold ? eagerly loaded, but we still animate reveal
          priority
          onLoad={() => setHeroImgLoaded(true)}
          placeholder="blur"
          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-transparent" />
      </div>

      {/* -- Floating Card ---------------------------------------------------- */}
      <div className="relative -mt-8 sm:-mt-12 z-10 px-3 sm:px-4 pb-6">
        <div className="bg-white rounded-t-[32px] shadow-2xl overflow-hidden">
          <div className="p-5 sm:p-6">

            {/* Title + Rating */}
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

            {/* Address */}
            {(restaurant.address || restaurant.city) && (
              <div className="flex items-center gap-2 mb-2 text-orange-600">
                <span className="text-sm font-medium">
                  {restaurant.address || `${restaurant.city || ''}${restaurant.state ? ', ' + restaurant.state : ''}`}
                </span>
              </div>
            )}

            {/* Cuisine & Price */}
            <div className="flex items-center gap-4 text-gray-500 text-sm mb-4">
              <span>{getCuisineTypes()}</span>
              <span className="w-1 h-1 bg-gray-300 rounded-full" />
              {/* <span>{getPriceForTwo()} for two</span> */}
            </div>

            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-2 mb-6">
              <span className="text-sm font-medium text-green-700">
                {/* {restaurant.status === 'APPROVED' ? 'Open Now' : 'Closed'} */}
                {restaurant.status = 'Open Now'}
              </span>
            </div>

            {/* -- Offer Carousel (lazy-rendered once offers arrive) -- */}
            {offers.length > 0 ? (
              <OfferCarousel
                offers={offers}
                currentOfferIndex={currentOfferIndex}
                setCurrentOfferIndex={setCurrentOfferIndex}
                carouselRef={carouselRef}
              />
            ) : (
              /* Skeleton while offers are loading */
              <div className="mb-6">
                <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4" />
                <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
              </div>
            )}

            {/* More Deals */}
            {/* <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">More deals for you</h3>
              <div className="flex flex-wrap gap-2">
                {['Pre-booking offers', 'Early bird discount', 'Weekend special', 'Flat ?100 OFF'].map((badge) => (
                  <button
                    key={badge}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-full transition-colors"
                  >
                    {badge}
                  </button>
                ))}
              </div>
            </div> */}

            {/* CTA */}
            <button
              onClick={selectAndOpen}
              className="w-full bg-orange-600 text-white py-4 rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 font-bold text-lg flex items-center justify-center gap-2"
            >
              View Menu & Order
              <ArrowRight className="h-5 w-5" />
            </button>

            <a
              href="https://share.google/J10F3DuvO2PcyK7Vn"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-4 text-lg font-bold text-orange-700 transition-all hover:bg-orange-100 hover:border-orange-300"
            >
              Rate Us on Google
              <Star className="h-5 w-5 fill-current" />
            </a>
          </div>
        </div>
      </div>

      {/* -- Footer Branding ---------------------------------------------------- */}
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
            <span className="font-semibold uppercase">Dequeue Retail Technologies Pvt Ltd.</span>
          </h3>
        </div>
      </div>
    </div>
  );
}
