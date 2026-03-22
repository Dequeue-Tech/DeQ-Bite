'use client';

import Image from 'next/image';
import { ChefHat, Minus, Plus } from 'lucide-react';
import { MenuItem, Category } from '@/lib/api-client';
import { formatInr } from '@/lib/currency';

export type MenuItemsSectionProps = {
  filteredItems: MenuItem[];
  categories: Category[];
  selectedCategory: string;
  getCartItemQuantity: (itemId: string) => number;
  onAddToCart: (item: MenuItem) => void;
  onUpdateQuantity: (item: MenuItem, newQuantity: number) => void;
  getSpiceLevelDisplay: (level: string) => string | null;
};

export default function MenuItemsSection({
  filteredItems,
  categories,
  selectedCategory,
  getCartItemQuantity,
  onAddToCart,
  onUpdateQuantity,
  getSpiceLevelDisplay,
}: MenuItemsSectionProps) {
  if (filteredItems.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12">
        <ChefHat className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
        <p className="text-gray-600 text-base sm:text-lg">
          No items found matching your criteria
        </p>
      </div>
    );
  }

  // Group items by category when showing all, respecting original category order
  const showAllCategories = selectedCategory === 'all';
  let itemsByCategory: Record<string, MenuItem[]> = {};

  if (showAllCategories) {
    // initialize keys in the order of categories array
    categories.forEach((cat) => {
      itemsByCategory[cat.name] = [];
    });

    filteredItems.forEach((item) => {
      const catName =
        categories.find((c) => c.id === item.categoryId)?.name || 'Other';
      if (!itemsByCategory[catName]) {
        itemsByCategory[catName] = [];
      }
      itemsByCategory[catName].push(item);
    });
  } else {
    itemsByCategory = { All: filteredItems };
  }

  // rotate each category list by 1 when showing all
  if (showAllCategories) {
    Object.keys(itemsByCategory).forEach((cat) => {
      const arr = itemsByCategory[cat];
      if (arr.length > 1) {
        itemsByCategory[cat] = [...arr.slice(1), arr[0]];
      }
    });
  }

  return (
    <div className="space-y-6">
      {Object.entries(itemsByCategory).map(([categoryName, items]) => (
        // Only render the category section if it actually has items inside it
        items.length > 0 && (
          <div key={categoryName}>
            {/* Category separator - only show when viewing all categories */}
            {showAllCategories && (
              <div className="flex items-center gap-4 mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 whitespace-nowrap">
                  {categoryName}
                </h2>
                <div className="flex-1 h-px bg-gray-300"></div>
                <span className="text-sm text-gray-500">{items.length} items</span>
              </div>
            )}

            {/* Items grid for this category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {items.map((item) => {
                const quantity = getCartItemQuantity(item.id);
                const spiceDisplay = getSpiceLevelDisplay(item.spiceLevel);

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-lg shadow-md overflow-hidden menu-item-card"
                  >
                    <div className="p-3 sm:p-4">
                      <div className="flex gap-3 sm:gap-4">
                        {/* Left side - Text content */}
                        <div className="flex-1 min-w-0">
                          {/* Dietary tags */}
                          <div className="flex items-center gap-2 mb-2 text-xs">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                item.isVeg ? 'bg-green-600' : 'bg-red-600'
                              }`}
                            ></span>
                            <span>{item.preparationTime} min</span>
                          </div>

                          <h3 className="text-sm sm:text-base font-semibold text-gray-800 line-clamp-1 mb-1">
                            {item.name || 'Unknown Item'}
                          </h3>
                          <p className="text-gray-600 text-xs sm:text-sm line-clamp-2 mb-2">
                            {item.description || ''}
                          </p>

                          <div className="flex items-center gap-3 mb-3">
                            {/* Price */}
                            <span className="text-base sm:text-lg font-extrabold text-orange-600 tracking-tight">
                              {formatInr(item.pricePaise)}
                            </span>

                            {/* Spice Level Badge (Only renders if there is a spice level) */}
                            {spiceDisplay && (
                              <>
                                <div className="w-[1px] h-4 bg-gray-200" />
                                <div className="flex items-center bg-orange-50 border border-orange-100 px-2 py-1 rounded-md">
                                  <span className="text-[10px] sm:text-xs font-medium text-orange-700 whitespace-nowrap">
                                    {spiceDisplay}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Right side - Image and Add button */}
                        <div className={`flex flex-col items-center gap-2 ${!item.image ? 'justify-center min-h-[80px]' : ''}`}>
                          {/* Item image - Only renders if the DB has an image URL */}
                          {item.image && (
                            <Image
                              src={encodeURI(item.image)}
                              alt={item.name || ''}
                              width={80}
                              height={80}
                              loading="lazy"
                              unoptimized
                              className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg shadow-sm"
                            />
                          )}

                          {/* Add button / Quantity controls */}
                          {quantity === 0 ? (
                            <button
                              onClick={() => onAddToCart(item)}
                              className="w-16 sm:w-20 bg-orange-600 text-white px-2 py-1.5 rounded-lg hover:bg-orange-700 transition-colors text-xs sm:text-sm font-medium"
                            >
                              Add
                            </button>
                          ) : (
                            <div className="flex items-center border border-gray-300 rounded-lg w-16 sm:w-20 justify-center bg-white">
                              <button
                                onClick={() => onUpdateQuantity(item, quantity - 1)}
                                className="p-1 sm:p-1.5 text-gray-600 hover:bg-gray-100 rounded-l-lg"
                              >
                                <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                              </button>
                              <span className="px-1 sm:px-2 py-0.5 text-xs sm:text-sm font-medium min-w-[1rem] text-center">
                                {quantity}
                              </span>
                              <button
                                onClick={() => onUpdateQuantity(item, quantity + 1)}
                                className="p-1 sm:p-1.5 text-gray-600 hover:bg-gray-100 rounded-r-lg"
                              >
                                <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ))}
    </div>
  );
}