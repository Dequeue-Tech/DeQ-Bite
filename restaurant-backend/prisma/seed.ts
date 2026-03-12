/// <reference types="node" />
import { PrismaClient, UserRole, RestaurantRole, SpiceLevel, OnboardingStatus, CouponType, OfferType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type RestaurantSeedConfig = {
  subdomain: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  cuisineTypes: string[];
  ownerEmail: string;
  categories: Array<{ name: string; description?: string }>;
  menuItems: Array<{
    name: string;
    description?: string;
    price: number;
    categoryName: string;
    isVeg: boolean;
    spiceLevel: SpiceLevel;
  }>;
  popularDishes: string[];
  tables: Array<{ number: number; capacity: number; location?: string }>;
  coupons: Array<{
    code: string;
    type: CouponType;
    value: number;
    minOrderPaise?: number;
    maxDiscountPaise?: number;
    active?: boolean;
  }>;
  offers: Array<{
    name: string;
    description?: string;
    discountType: 'PERCENT' | 'FIXED';
    value: number;
    minOrderPaise?: number;
    maxDiscountPaise?: number;
    type?: OfferType;
    active?: boolean;
  }>;
};

const restaurantConfigs: RestaurantSeedConfig[] = [
  {
    subdomain: 'demo',
    name: 'Demo Restaurant',
    email: 'demo@restaurant.com',
    phone: '+91 90000 00000',
    address: '123 Demo Street, Bengaluru',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    cuisineTypes: ['Indian', 'Continental'],
    ownerEmail: 'owner@demo.com',
    categories: [
      { name: 'Appetizers', description: 'Start your meal with favorites' },
      { name: 'Main Courses', description: 'Signature mains' },
      { name: 'Desserts', description: 'Sweet endings' },
    ],
    menuItems: [
      { name: 'Paneer Tikka', description: 'Smoky paneer skewers', price: 299, categoryName: 'Appetizers', isVeg: true, spiceLevel: SpiceLevel.MEDIUM },
      { name: 'Chicken Wings', description: 'Crispy wings with spice rub', price: 349, categoryName: 'Appetizers', isVeg: false, spiceLevel: SpiceLevel.HOT },
      { name: 'Butter Chicken', description: 'Creamy tomato gravy', price: 449, categoryName: 'Main Courses', isVeg: false, spiceLevel: SpiceLevel.MILD },
      { name: 'Dal Makhani', description: 'Slow cooked lentils', price: 299, categoryName: 'Main Courses', isVeg: true, spiceLevel: SpiceLevel.MILD },
      { name: 'Gulab Jamun', description: 'Classic dessert', price: 149, categoryName: 'Desserts', isVeg: true, spiceLevel: SpiceLevel.NONE },
    ],
    popularDishes: ['Butter Chicken', 'Paneer Tikka', 'Dal Makhani'],
    tables: [
      { number: 1, capacity: 2, location: 'Window side' },
      { number: 2, capacity: 4, location: 'Center area' },
    ],
    coupons: [
      { code: 'WELCOME10', type: CouponType.PERCENT, value: 10, minOrderPaise: 50000, maxDiscountPaise: 20000, active: true },
      { code: 'FLAT50', type: CouponType.FIXED, value: 5000, minOrderPaise: 20000, active: true },
    ],
    offers: [
      { name: 'Weekend Special', description: '10% off on weekends', discountType: 'PERCENT', value: 10, minOrderPaise: 40000, maxDiscountPaise: 25000, type: OfferType.PERCENTAGE, active: true },
    ],
  },
  {
    subdomain: 'spice-garden',
    name: 'Spice Garden',
    email: 'hello@spicegarden.com',
    phone: '+91 91234 56780',
    address: '78 Residency Road, Bengaluru',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    cuisineTypes: ['North Indian'],
    ownerEmail: 'owner@spicegarden.com',
    categories: [
      { name: 'Starters', description: 'Tandoori delights' },
      { name: 'Main Course', description: 'Rich curries' },
      { name: 'Breads', description: 'Fresh from the tandoor' },
    ],
    menuItems: [
      { name: 'Paneer Tikka', description: 'Charred paneer with spices', price: 350, categoryName: 'Starters', isVeg: true, spiceLevel: SpiceLevel.MEDIUM },
      { name: 'Dal Makhani', description: 'Creamy lentils', price: 450, categoryName: 'Main Course', isVeg: true, spiceLevel: SpiceLevel.MILD },
      { name: 'Butter Naan', description: 'Soft naan with butter', price: 60, categoryName: 'Breads', isVeg: true, spiceLevel: SpiceLevel.NONE },
    ],
    popularDishes: ['Dal Makhani', 'Paneer Tikka'],
    tables: [
      { number: 1, capacity: 4, location: 'Family zone' },
      { number: 2, capacity: 2, location: 'Couple seating' },
    ],
    coupons: [
      { code: 'SPICE15', type: CouponType.PERCENT, value: 15, minOrderPaise: 60000, maxDiscountPaise: 30000, active: true },
    ],
    offers: [
      { name: 'Lunch Saver', description: 'Flat 75 off on lunch', discountType: 'FIXED', value: 7500, minOrderPaise: 25000, type: OfferType.FIXED_AMOUNT, active: true },
    ],
  },
  {
    subdomain: 'coastal-bites',
    name: 'Coastal Bites',
    email: 'team@coastalbites.com',
    phone: '+91 92222 11133',
    address: '22 Beach Road, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    cuisineTypes: ['Seafood', 'Continental'],
    ownerEmail: 'owner@coastalbites.com',
    categories: [
      { name: 'Fresh Catch', description: 'Straight from the ocean' },
      { name: 'Beverages', description: 'Coastal coolers' },
      { name: 'Desserts', description: 'Sweet treats' },
    ],
    menuItems: [
      { name: 'Grilled Salmon', description: 'Herb grilled salmon', price: 850, categoryName: 'Fresh Catch', isVeg: false, spiceLevel: SpiceLevel.MEDIUM },
      { name: 'Prawn Curry', description: 'Coastal style curry', price: 650, categoryName: 'Fresh Catch', isVeg: false, spiceLevel: SpiceLevel.HOT },
      { name: 'Fresh Lime Soda', description: 'Citrus fizz', price: 120, categoryName: 'Beverages', isVeg: true, spiceLevel: SpiceLevel.NONE },
      { name: 'Chocolate Lava Cake', description: 'Warm chocolate center', price: 199, categoryName: 'Desserts', isVeg: true, spiceLevel: SpiceLevel.NONE },
    ],
    popularDishes: ['Grilled Salmon', 'Prawn Curry', 'Fresh Lime Soda'],
    tables: [
      { number: 1, capacity: 6, location: 'Sea view' },
      { number: 2, capacity: 4, location: 'Indoor' },
    ],
    coupons: [
      { code: 'SEAFOOD20', type: CouponType.PERCENT, value: 20, minOrderPaise: 80000, maxDiscountPaise: 50000, active: true },
    ],
    offers: [
      { name: 'Happy Hours', description: '15% off between 4-6 PM', discountType: 'PERCENT', value: 15, minOrderPaise: 30000, type: OfferType.PERCENTAGE, active: true },
    ],
  },
  {
    subdomain: 'urban-cafe',
    name: 'Urban Cafe',
    email: 'contact@urbancafe.com',
    phone: '+91 93333 22210',
    address: '5 Park Street, Kolkata',
    city: 'Kolkata',
    state: 'West Bengal',
    country: 'India',
    cuisineTypes: ['Cafe', 'Desserts'],
    ownerEmail: 'owner@urbancafe.com',
    categories: [
      { name: 'Coffee', description: 'Fresh brews' },
      { name: 'Beverages', description: 'Smooth sips' },
      { name: 'Desserts', description: 'Cafe favorites' },
    ],
    menuItems: [
      { name: 'Filter Coffee', description: 'South Indian brew', price: 69, categoryName: 'Coffee', isVeg: true, spiceLevel: SpiceLevel.NONE },
      { name: 'Mango Lassi', description: 'Creamy mango drink', price: 119, categoryName: 'Beverages', isVeg: true, spiceLevel: SpiceLevel.NONE },
      { name: 'Chocolate Lava Cake', description: 'Warm chocolate cake', price: 199, categoryName: 'Desserts', isVeg: true, spiceLevel: SpiceLevel.NONE },
    ],
    popularDishes: ['Filter Coffee', 'Chocolate Lava Cake'],
    tables: [
      { number: 1, capacity: 2, location: 'Window bar' },
      { number: 2, capacity: 2, location: 'Quiet corner' },
    ],
    coupons: [
      { code: 'CAFE5', type: CouponType.PERCENT, value: 5, minOrderPaise: 15000, maxDiscountPaise: 8000, active: true },
    ],
    offers: [
      { name: 'Dessert Duo', description: 'Flat 30 off on desserts', discountType: 'FIXED', value: 3000, minOrderPaise: 12000, type: OfferType.FIXED_AMOUNT, active: true },
    ],
  },
];

async function upsertRestaurant(config: RestaurantSeedConfig) {
  return prisma.restaurant.upsert({
    where: { subdomain: config.subdomain },
    update: {
      name: config.name,
      email: config.email,
      phone: config.phone,
      address: config.address,
      city: config.city,
      state: config.state,
      country: config.country,
      cuisineTypes: config.cuisineTypes,
      status: OnboardingStatus.APPROVED,
      active: true,
      acceptedPaymentMethods: ['RAZORPAY', 'CASH'],
    },
    create: {
      name: config.name,
      slug: config.subdomain,
      subdomain: config.subdomain,
      email: config.email,
      phone: config.phone,
      address: config.address,
      city: config.city,
      state: config.state,
      country: config.country,
      status: OnboardingStatus.APPROVED,
      commissionRate: 10,
      cuisineTypes: config.cuisineTypes,
      acceptedPaymentMethods: ['RAZORPAY', 'CASH'],
      active: true,
    },
  });
}

async function upsertOwner(config: RestaurantSeedConfig) {
  const owner = await prisma.user.upsert({
    where: { email: config.ownerEmail },
    update: { role: UserRole.OWNER },
    create: {
      email: config.ownerEmail,
      name: `${config.name} Owner`,
      password: await bcrypt.hash('owner123', 12),
      role: UserRole.OWNER,
      verified: true,
    },
  });
  return owner;
}

async function main() {
  for (const config of restaurantConfigs) {
    console.log(`Seeding: ${config.name}...`);

    const restaurant = await upsertRestaurant(config);
    const owner = await upsertOwner(config);

    await prisma.restaurantUser.upsert({
      where: { restaurantId_userId: { restaurantId: restaurant.id, userId: owner.id } },
      update: { role: RestaurantRole.OWNER, active: true },
      create: { restaurantId: restaurant.id, userId: owner.id, role: RestaurantRole.OWNER, active: true },
    });

    // Categories
    const categoryIdByName: Record<string, string> = {};
    for (const category of config.categories) {
      const saved = await prisma.category.upsert({
        where: { restaurantId_name: { restaurantId: restaurant.id, name: category.name } },
        update: { description: category.description ?? null, active: true },
        create: {
          name: category.name,
          description: category.description ?? null,
          active: true,
          sortOrder: 0,
          restaurantId: restaurant.id,
        },
      });
      categoryIdByName[category.name] = saved.id;
    }

    // Menu items (no unique constraint on name+restaurantId, so use findFirst)
    for (const item of config.menuItems) {
      const categoryId = categoryIdByName[item.categoryName];
      if (!categoryId) continue;

      const existing = await prisma.menuItem.findFirst({
        where: { restaurantId: restaurant.id, name: item.name },
        select: { id: true },
      });

      const data = {
        name: item.name,
        description: item.description ?? null,
        pricePaise: Math.round(item.price * 100),
        categoryId,
        restaurantId: restaurant.id,
        available: true,
        spiceLevel: item.spiceLevel,
        isVeg: item.isVeg,
      };

      if (existing) {
        await prisma.menuItem.update({ where: { id: existing.id }, data });
      } else {
        await prisma.menuItem.create({ data });
      }
    }

    // Popular dishes
    const menuItems = await prisma.menuItem.findMany({
      where: { restaurantId: restaurant.id },
      select: { id: true, name: true },
    });
    const menuItemIdByName = new Map(menuItems.map((m) => [m.name, m.id]));
    for (let i = 0; i < config.popularDishes.length; i++) {
      const menuItemId = menuItemIdByName.get(config.popularDishes[i]);
      if (!menuItemId) continue;
      await prisma.popularDish.upsert({
        where: { restaurantId_menuItemId: { restaurantId: restaurant.id, menuItemId } },
        update: { rank: i + 1, active: true },
        create: { restaurantId: restaurant.id, menuItemId, rank: i + 1, active: true },
      });
    }

    // Tables
    for (const table of config.tables) {
      await prisma.table.upsert({
        where: { restaurantId_number: { restaurantId: restaurant.id, number: table.number } },
        update: { capacity: table.capacity, location: table.location ?? null, active: true },
        create: {
          number: table.number,
          capacity: table.capacity,
          location: table.location ?? null,
          active: true,
          restaurantId: restaurant.id,
        },
      });
    }

    // Coupons
    for (const coupon of config.coupons) {
      await prisma.coupon.upsert({
        where: { restaurantId_code: { restaurantId: restaurant.id, code: coupon.code } },
        update: {
          active: coupon.active ?? true,
          type: coupon.type,
          value: coupon.value,
          minOrderPaise: coupon.minOrderPaise ?? null,
          maxDiscountPaise: coupon.maxDiscountPaise ?? null,
        },
        create: {
          restaurantId: restaurant.id,
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          active: coupon.active ?? true,
          minOrderPaise: coupon.minOrderPaise ?? null,
          maxDiscountPaise: coupon.maxDiscountPaise ?? null,
        },
      });
    }

    // Offers (no unique constraint, so use name + restaurantId)
    for (const offer of config.offers) {
      const existingOffer = await prisma.offer.findFirst({
        where: { restaurantId: restaurant.id, name: offer.name },
        select: { id: true },
      });

      const offerData = {
        name: offer.name,
        description: offer.description ?? null,
        discountType: offer.discountType,
        value: offer.value,
        minOrderPaise: offer.minOrderPaise ?? null,
        maxDiscountPaise: offer.maxDiscountPaise ?? null,
        type: offer.type ?? null,
        active: offer.active ?? true,
        restaurantId: restaurant.id,
      };

      if (existingOffer) {
        await prisma.offer.update({ where: { id: existingOffer.id }, data: offerData });
      } else {
        await prisma.offer.create({ data: offerData });
      }
    }
  }

  console.log('Seeding complete: multiple restaurants with unique menus, popular dishes, coupons, and offers.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
