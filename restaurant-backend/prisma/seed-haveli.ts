import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface HaveliMenuItem {
  name: string;
  price: string;
  desc: string;
  dietary_slugs: string;
  image: string;
}

interface HaveliCategory {
  name: string;
  items: HaveliMenuItem[];
}

interface HaveliMenu {
  name: string;
  category: HaveliCategory[];
}

interface HaveliData {
  name: string;
  menus: HaveliMenu[];
}

function parsePrice(priceStr: any): number {
  if (!priceStr) return 0;
  if (typeof priceStr === 'number') return priceStr;
  const str = String(priceStr).replace(/[^\d.]/g, '');
  const price = parseFloat(str);
  return isNaN(price) ? 0 : price;
}

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=400&h=300&fit=crop'; 

function determineSpiceLevel(name: string, desc: string): string {
  const text = (name + ' ' + desc).toLowerCase();
  if (text.includes('extra hot') || text.includes('very spicy')) return 'EXTRA_HOT';
  if (text.includes('hot') || text.includes('spicy') || text.includes('chilli')) return 'HOT';
  if (text.includes('medium')) return 'MEDIUM';
  if (text.includes('mild')) return 'MILD';
  return 'MEDIUM';
}

async function main() {
  // Read the Haveli Dhaba JSON file
  const filePath = path.join(__dirname, '..', 'dist', 'Haveli Dhaba.json');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const haveliData: HaveliData = JSON.parse(fileContent);

  // Get the demo restaurant
  const restaurant = await prisma.restaurant.findUnique({
    where: { subdomain: 'demo' },
  });

  if (!restaurant) {
    console.error('Demo restaurant not found. Please run the main seed first.');
    process.exit(1);
  }

  console.log(`Importing menu for: ${haveliData.name}`);

  // Delete existing categories and menu items for this restaurant
  await prisma.menuItem.deleteMany({
    where: { restaurantId: restaurant.id },
  });
  await prisma.category.deleteMany({
    where: { restaurantId: restaurant.id },
  });

  console.log('Cleared existing menu items and categories');

  let totalItems = 0;
  const createdItems = new Set<string>(); // Track created items to avoid duplicates

  // Process each menu section
  for (const menu of haveliData.menus) {
    console.log(`\nProcessing menu: ${menu.name}`);

    for (const cat of menu.category) {
      const categoryName = cat.name || menu.name;
      
      // Create or get category
      let category = await prisma.category.findFirst({
        where: {
          restaurantId: restaurant.id,
          name: categoryName,
        },
      });

      if (!category) {
        category = await prisma.category.create({
          data: {
            name: categoryName,
            description: `Delicious ${categoryName} items`,
            active: true,
            sortOrder: 0,
            restaurantId: restaurant.id,
          },
        });
        console.log(`  Created category: ${categoryName}`);
      }

      // Create menu items (skip duplicates)
      for (const item of cat.items) {
        // Skip if item with same name already created
        if (createdItems.has(item.name)) {
          console.log(`    Skipping duplicate: ${item.name}`);
          continue;
        }

        const price = parsePrice(item.price);
        const isVeg = item.dietary_slugs === 'veg';

        await prisma.menuItem.create({
          data: {
            name: item.name,
            description: item.desc || `${item.name} - A delicious dish`,
            pricePaise: Math.round(price * 100), // Convert to paise
            image: item.image && item.image.trim() !== '' ? item.image : null,
            categoryId: category.id,
            available: true,
            preparationTime: 20,
            ingredients: [],
            allergens: [],
            isVeg: isVeg,
            isVegan: false,
            isGlutenFree: false,
            spiceLevel: determineSpiceLevel(item.name, item.desc),
            restaurantId: restaurant.id,
          },
        });
        createdItems.add(item.name);
        totalItems++;
      }
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`Total menu items imported: ${totalItems}`);
  console.log(`Restaurant: ${restaurant.name} (${restaurant.subdomain})`);
}

main()
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
