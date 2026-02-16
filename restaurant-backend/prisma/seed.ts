import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { sampleCategories, sampleMenuItems, sampleTables } from '../src/lib/sampleData';

const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurant.upsert({
    where: { subdomain: 'demo' },
    update: {
      name: 'Demo Restaurant',
      slug: 'demo',
      subdomain: 'demo',
      active: true,
    },
    create: {
      name: 'Demo Restaurant',
      slug: 'demo',
      subdomain: 'demo',
      email: 'demo@restaurant.com',
      phone: '+91 90000 00000',
      address: '123 Demo Street, Bengaluru',
    },
  });

  const ownerPassword = await bcrypt.hash('owner123', 12);
  const adminPassword = await bcrypt.hash('admin123', 12);
  const staffPassword = await bcrypt.hash('staff123', 12);
  const customerPassword = await bcrypt.hash('customer123', 12);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo.com' },
    update: { name: 'Demo Owner', role: 'OWNER' },
    create: {
      email: 'owner@demo.com',
      name: 'Demo Owner',
      password: ownerPassword,
      role: 'OWNER',
      verified: true,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: { name: 'Demo Admin', role: 'ADMIN' },
    create: {
      email: 'admin@demo.com',
      name: 'Demo Admin',
      password: adminPassword,
      role: 'ADMIN',
      verified: true,
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: 'staff@demo.com' },
    update: { name: 'Demo Staff', role: 'STAFF' },
    create: {
      email: 'staff@demo.com',
      name: 'Demo Staff',
      password: staffPassword,
      role: 'STAFF',
      verified: true,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@demo.com' },
    update: { name: 'Demo Customer', role: 'CUSTOMER' },
    create: {
      email: 'customer@demo.com',
      name: 'Demo Customer',
      password: customerPassword,
      role: 'CUSTOMER',
      verified: true,
    },
  });

  await prisma.restaurantUser.upsert({
    where: {
      restaurantId_userId: {
        restaurantId: restaurant.id,
        userId: owner.id,
      },
    },
    update: { role: 'OWNER', active: true },
    create: { restaurantId: restaurant.id, userId: owner.id, role: 'OWNER' },
  });

  await prisma.restaurantUser.upsert({
    where: {
      restaurantId_userId: {
        restaurantId: restaurant.id,
        userId: admin.id,
      },
    },
    update: { role: 'ADMIN', active: true },
    create: { restaurantId: restaurant.id, userId: admin.id, role: 'ADMIN' },
  });

  await prisma.restaurantUser.upsert({
    where: {
      restaurantId_userId: {
        restaurantId: restaurant.id,
        userId: staff.id,
      },
    },
    update: { role: 'STAFF', active: true },
    create: { restaurantId: restaurant.id, userId: staff.id, role: 'STAFF' },
  });

  const categoryIdByName: Record<string, string> = {};
  for (const category of sampleCategories) {
    const saved = await prisma.category.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name: category.name,
        },
      },
      update: {
        description: category.description,
        image: category.image,
        active: category.active,
        sortOrder: category.sortOrder,
      },
      create: {
        name: category.name,
        description: category.description,
        image: category.image,
        active: category.active,
        sortOrder: category.sortOrder,
        restaurantId: restaurant.id,
      },
    });
    categoryIdByName[category.name] = saved.id;
  }

  for (const item of sampleMenuItems) {
    const categoryName = sampleCategories.find((cat) => cat.id === item.categoryId)?.name;
    const categoryId = categoryName ? categoryIdByName[categoryName] : undefined;
    if (!categoryId) continue;

    const existing = await prisma.menuItem.findFirst({
      where: {
        restaurantId: restaurant.id,
        name: item.name,
      },
    });

    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: {
          description: item.description,
          pricePaise: Math.round(item.price * 100),
          image: item.image,
          categoryId,
          available: item.available,
          preparationTime: item.preparationTime,
          ingredients: item.ingredients,
          allergens: item.allergens,
          isVeg: item.isVeg,
          isVegan: item.isVegan,
          isGlutenFree: item.isGlutenFree,
          spiceLevel: item.spiceLevel,
        },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          name: item.name,
          description: item.description,
          pricePaise: Math.round(item.price * 100),
          image: item.image,
          categoryId,
          available: item.available,
          preparationTime: item.preparationTime,
          ingredients: item.ingredients,
          allergens: item.allergens,
          isVeg: item.isVeg,
          isVegan: item.isVegan,
          isGlutenFree: item.isGlutenFree,
          spiceLevel: item.spiceLevel,
          restaurantId: restaurant.id,
        },
      });
    }
  }

  for (const table of sampleTables) {
    await prisma.table.upsert({
      where: {
        restaurantId_number: {
          restaurantId: restaurant.id,
          number: table.number,
        },
      },
      update: {
        capacity: table.capacity,
        location: table.location,
        active: table.active,
      },
      create: {
        number: table.number,
        capacity: table.capacity,
        location: table.location,
        active: table.active,
        restaurantId: restaurant.id,
      },
    });
  }

  await prisma.coupon.upsert({
    where: {
      restaurantId_code: {
        restaurantId: restaurant.id,
        code: 'WELCOME10',
      },
    },
    update: {
      active: true,
      type: 'PERCENT',
      value: 10,
    },
    create: {
      restaurantId: restaurant.id,
      code: 'WELCOME10',
      type: 'PERCENT',
      value: 10,
      active: true,
      minOrderPaise: 50000,
      maxDiscountPaise: 20000,
    },
  });

  await prisma.coupon.upsert({
    where: {
      restaurantId_code: {
        restaurantId: restaurant.id,
        code: 'FLAT50',
      },
    },
    update: {
      active: true,
      type: 'FIXED',
      value: 5000,
    },
    create: {
      restaurantId: restaurant.id,
      code: 'FLAT50',
      type: 'FIXED',
      value: 5000,
      active: true,
      minOrderPaise: 20000,
    },
  });

  console.log('Seed completed.');
  console.log('Demo restaurant subdomain: demo');
  console.log('Owner: owner@demo.com / owner123');
  console.log('Admin: admin@demo.com / admin123');
  console.log('Staff: staff@demo.com / staff123');
  console.log('Customer: customer@demo.com / customer123');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
