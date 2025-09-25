import { PrismaClient, SpiceLevel, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@restaurant.com' },
    update: {},
    create: {
      email: 'admin@restaurant.com',
      name: 'Restaurant Admin',
      password: hashedPassword,
      role: UserRole.ADMIN,
      verified: true,
    },
  });

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Appetizers' },
      update: {},
      create: {
        name: 'Appetizers',
        description: 'Start your meal with our delicious appetizers',
        sortOrder: 1,
      },
    }),
    prisma.category.upsert({
      where: { name: 'Main Courses' },
      update: {},
      create: {
        name: 'Main Courses',
        description: 'Hearty and satisfying main dishes',
        sortOrder: 2,
      },
    }),
    prisma.category.upsert({
      where: { name: 'Desserts' },
      update: {},
      create: {
        name: 'Desserts',
        description: 'Sweet endings to your meal',
        sortOrder: 3,
      },
    }),
    prisma.category.upsert({
      where: { name: 'Beverages' },
      update: {},
      create: {
        name: 'Beverages',
        description: 'Refreshing drinks and beverages',
        sortOrder: 4,
      },
    }),
  ]);

  // Create menu items
  const menuItems = await Promise.all([
    // Appetizers
    prisma.menuItem.upsert({
      where: { id: 'appetizer-1' },
      update: {},
      create: {
        id: 'appetizer-1',
        name: 'Spring Rolls',
        description: 'Crispy vegetable spring rolls served with sweet chili sauce',
        price: 8.99,
        categoryId: categories[0].id,
        preparationTime: 10,
        ingredients: ['Vegetables', 'Spring roll wrapper', 'Sweet chili sauce'],
        isVeg: true,
        spiceLevel: SpiceLevel.MILD,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'appetizer-2' },
      update: {},
      create: {
        id: 'appetizer-2',
        name: 'Chicken Wings',
        description: 'Spicy buffalo chicken wings with ranch dressing',
        price: 12.99,
        categoryId: categories[0].id,
        preparationTime: 15,
        ingredients: ['Chicken wings', 'Buffalo sauce', 'Ranch dressing'],
        isVeg: false,
        spiceLevel: SpiceLevel.HOT,
      },
    }),

    // Main Courses
    prisma.menuItem.upsert({
      where: { id: 'main-1' },
      update: {},
      create: {
        id: 'main-1',
        name: 'Grilled Chicken Breast',
        description: 'Perfectly seasoned grilled chicken with vegetables',
        price: 18.99,
        categoryId: categories[1].id,
        preparationTime: 25,
        ingredients: ['Chicken breast', 'Mixed vegetables', 'Herbs', 'Olive oil'],
        isVeg: false,
        spiceLevel: SpiceLevel.MILD,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'main-2' },
      update: {},
      create: {
        id: 'main-2',
        name: 'Vegetarian Pasta',
        description: 'Fresh pasta with seasonal vegetables in tomato sauce',
        price: 15.99,
        categoryId: categories[1].id,
        preparationTime: 20,
        ingredients: ['Pasta', 'Tomatoes', 'Bell peppers', 'Onions', 'Herbs'],
        isVeg: true,
        isVegan: true,
        spiceLevel: SpiceLevel.MILD,
      },
    }),

    // Desserts
    prisma.menuItem.upsert({
      where: { id: 'dessert-1' },
      update: {},
      create: {
        id: 'dessert-1',
        name: 'Chocolate Cake',
        description: 'Rich chocolate cake with vanilla ice cream',
        price: 7.99,
        categoryId: categories[2].id,
        preparationTime: 5,
        ingredients: ['Chocolate', 'Flour', 'Sugar', 'Vanilla ice cream'],
        isVeg: true,
        spiceLevel: SpiceLevel.NONE,
      },
    }),

    // Beverages
    prisma.menuItem.upsert({
      where: { id: 'beverage-1' },
      update: {},
      create: {
        id: 'beverage-1',
        name: 'Fresh Orange Juice',
        description: 'Freshly squeezed orange juice',
        price: 4.99,
        categoryId: categories[3].id,
        preparationTime: 2,
        ingredients: ['Fresh oranges'],
        isVeg: true,
        isVegan: true,
        spiceLevel: SpiceLevel.NONE,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'beverage-2' },
      update: {},
      create: {
        id: 'beverage-2',
        name: 'Coffee',
        description: 'Freshly brewed coffee',
        price: 3.99,
        categoryId: categories[3].id,
        preparationTime: 3,
        ingredients: ['Coffee beans', 'Water'],
        isVeg: true,
        isVegan: true,
        spiceLevel: SpiceLevel.NONE,
      },
    }),
  ]);

  // Create tables
  const tables = await Promise.all([
    prisma.table.upsert({
      where: { number: 1 },
      update: {},
      create: {
        number: 1,
        capacity: 2,
        location: 'Window side',
      },
    }),
    prisma.table.upsert({
      where: { number: 2 },
      update: {},
      create: {
        number: 2,
        capacity: 4,
        location: 'Center',
      },
    }),
    prisma.table.upsert({
      where: { number: 3 },
      update: {},
      create: {
        number: 3,
        capacity: 6,
        location: 'Garden area',
      },
    }),
    prisma.table.upsert({
      where: { number: 4 },
      update: {},
      create: {
        number: 4,
        capacity: 2,
        location: 'Balcony',
      },
    }),
    prisma.table.upsert({
      where: { number: 5 },
      update: {},
      create: {
        number: 5,
        capacity: 8,
        location: 'Private room',
      },
    }),
  ]);

  console.log('✅ Database seeded successfully!');
  console.log(`Created admin user: ${admin.email}`);
  console.log(`Created ${categories.length} categories`);
  console.log(`Created ${menuItems.length} menu items`);
  console.log(`Created ${tables.length} tables`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });