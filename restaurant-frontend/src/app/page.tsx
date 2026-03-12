import Link from 'next/link';

type RestaurantListItem = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  logoUrl: string | null;
};

async function getRestaurants(): Promise<RestaurantListItem[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  const response = await fetch(`${apiBase}/restaurants/public/search`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    success?: boolean;
    data?: {
      restaurants?: Array<
        Omit<RestaurantListItem, 'slug' | 'logoUrl'> & {
          slug?: string;
          subdomain?: string;
          logoUrl?: string | null;
        }
      >;
    };
  };

  const restaurants = payload.data?.restaurants ?? [];

  return restaurants.map((restaurant) => ({
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug || restaurant.subdomain || restaurant.id,
    address: restaurant.address ?? null,
    logoUrl: restaurant.logoUrl ?? null,
  }));
}

export default async function HomePage() {
  const restaurants = await getRestaurants();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-10">
        <div className="mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
            Choose Your Restaurant
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2">
            Each restaurant has its own menu and ordering flow.
          </p>
        </div>

        {restaurants.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-gray-700">
            No restaurants available yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {restaurants.map((restaurant) => (
              <Link
                key={restaurant.id}
                href={`/${restaurant.slug}`}
                className="group bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 hover:border-orange-200 hover:shadow-lg transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-orange-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {restaurant.logoUrl ? (
                      <img
                        src={restaurant.logoUrl}
                        alt={restaurant.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-orange-600 font-bold text-lg">
                        {restaurant.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                      {restaurant.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">
                      {restaurant.address || 'Address not provided'}
                    </p>
                    <p className="text-xs text-orange-600 mt-2">
                      View menu -
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
