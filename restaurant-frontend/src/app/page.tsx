import SearchableRestaurantList, { RestaurantListItem } from './SearchableRestaurantList';

async function getRestaurants(): Promise<RestaurantListItem[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
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

  // Pass the server-fetched data to the interactive client component
  return <SearchableRestaurantList initialRestaurants={restaurants} />;
}