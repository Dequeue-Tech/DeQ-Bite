// Sample data for restaurant web app development and testing
// TypeScript version for separated backend architecture

export const sampleCategories = [
  {
    id: "cat_1",
    name: "Appetizers",
    description: "Start your meal with our delicious appetizers",
    image: "/images/categories/appetizers.jpg",
    active: true,
    sortOrder: 1
  },
  {
    id: "cat_2", 
    name: "Main Courses",
    description: "Hearty and satisfying main dishes",
    image: "/images/categories/mains.jpg",
    active: true,
    sortOrder: 2
  },
  {
    id: "cat_3",
    name: "Desserts", 
    description: "Sweet endings to your meal",
    image: "/images/categories/desserts.jpg",
    active: true,
    sortOrder: 3
  },
  {
    id: "cat_4",
    name: "Beverages",
    description: "Refreshing drinks and beverages", 
    image: "/images/categories/beverages.jpg",
    active: true,
    sortOrder: 4
  }
];

export const sampleMenuItems = [
  // Appetizers
  {
    id: "item_1",
    name: "Paneer Tikka",
    description: "Grilled cottage cheese marinated in Indian spices with bell peppers and onions",
    price: 299,
    image: "https://www.indianveggiedelight.com/wp-content/uploads/2021/08/air-fryer-paneer-tikka-featured.jpg",
    categoryId: "cat_1",
    category: { id: "cat_1", name: "Appetizers" },
    available: true,
    preparationTime: 15,
    ingredients: ["Paneer", "Bell peppers", "Onions", "Yogurt", "Spices"],
    allergens: ["Dairy"],
    isVeg: true,
    isVegan: false,
    isGlutenFree: true,
    spiceLevel: "MEDIUM"
  },
  {
    id: "item_2", 
    name: "Chicken Wings",
    description: "Crispy chicken wings tossed in spicy buffalo sauce",
    price: 349,
    image: "https://tastesbetterfromscratch.com/wp-content/uploads/2014/09/Baked-Chicken-Wings-3.jpg",
    categoryId: "cat_1",
    category: { id: "cat_1", name: "Appetizers" },
    available: true,
    preparationTime: 20,
    ingredients: ["Chicken wings", "Hot sauce", "Butter", "Celery", "Blue cheese"],
    allergens: ["Dairy"],
    isVeg: false,
    isVegan: false,
    isGlutenFree: true,
    spiceLevel: "HOT"
  },
  {
    id: "item_3",
    name: "Vegetable Spring Rolls",
    description: "Crispy spring rolls filled with fresh vegetables and served with sweet chili sauce",
    price: 249,
    image: "/images/menu/spring-rolls.jpg", 
    categoryId: "cat_1",
    category: { id: "cat_1", name: "Appetizers" },
    available: true,
    preparationTime: 12,
    ingredients: ["Cabbage", "Carrots", "Bean sprouts", "Mushrooms", "Spring roll wrappers"],
    allergens: ["Gluten"],
    isVeg: true,
    isVegan: true,
    isGlutenFree: false,
    spiceLevel: "MILD"
  },

  // Main Courses
  {
    id: "item_4",
    name: "Butter Chicken",
    description: "Tender chicken pieces in a rich, creamy tomato-based curry",
    price: 449,
    image: "/images/menu/butter-chicken.jpg",
    categoryId: "cat_2", 
    category: { id: "cat_2", name: "Main Courses" },
    available: true,
    preparationTime: 25,
    ingredients: ["Chicken", "Tomatoes", "Heavy cream", "Butter", "Onions", "Garlic", "Ginger", "Spices"],
    allergens: ["Dairy"],
    isVeg: false,
    isVegan: false,
    isGlutenFree: true,
    spiceLevel: "MILD"
  },
  {
    id: "item_5",
    name: "Dal Makhani", 
    description: "Rich and creamy black lentil curry slow-cooked with butter and cream",
    price: 299,
    image: "/images/menu/dal-makhani.jpg",
    categoryId: "cat_2",
    category: { id: "cat_2", name: "Main Courses" },
    available: true,
    preparationTime: 20,
    ingredients: ["Black lentils", "Kidney beans", "Cream", "Butter", "Tomatoes", "Onions", "Spices"],
    allergens: ["Dairy"],
    isVeg: true,
    isVegan: false,
    isGlutenFree: true,
    spiceLevel: "MILD"
  },
  {
    id: "item_6",
    name: "Grilled Salmon",
    description: "Fresh Atlantic salmon grilled to perfection with herbs and lemon",
    price: 599,
    image: "/images/menu/grilled-salmon.jpg",
    categoryId: "cat_2",
    category: { id: "cat_2", name: "Main Courses" },
    available: true,
    preparationTime: 18,
    ingredients: ["Salmon fillet", "Lemon", "Herbs", "Olive oil", "Garlic"],
    allergens: ["Fish"],
    isVeg: false,
    isVegan: false,
    isGlutenFree: true,
    spiceLevel: "NONE"
  },
  {
    id: "item_7",
    name: "Vegetable Biryani",
    description: "Fragrant basmati rice cooked with mixed vegetables and aromatic spices",
    price: 349,
    image: "/images/menu/veg-biryani.jpg",
    categoryId: "cat_2",
    category: { id: "cat_2", name: "Main Courses" },
    available: true,
    preparationTime: 30,
    ingredients: ["Basmati rice", "Mixed vegetables", "Saffron", "Yogurt", "Onions", "Spices"],
    allergens: ["Dairy"],
    isVeg: true,
    isVegan: false,
    isGlutenFree: true,
    spiceLevel: "MEDIUM"
  },

  // Desserts
  {
    id: "item_8",
    name: "Gulab Jamun",
    description: "Soft milk dumplings soaked in rose-flavored sugar syrup",
    price: 149,
    image: "/images/menu/gulab-jamun.jpg",
    categoryId: "cat_3",
    category: { id: "cat_3", name: "Desserts" },
    available: true,
    preparationTime: 5,
    ingredients: ["Milk powder", "Sugar", "Cardamom", "Rose water", "Ghee"],
    allergens: ["Dairy"],
    isVeg: true,
    isVegan: false,
    isGlutenFree: true,
    spiceLevel: "NONE"
  },
  {
    id: "item_9",
    name: "Chocolate Lava Cake",
    description: "Warm chocolate cake with a molten chocolate center, served with vanilla ice cream",
    price: 199,
    image: "/images/menu/chocolate-lava-cake.jpg",
    categoryId: "cat_3",
    category: { id: "cat_3", name: "Desserts" },
    available: true,
    preparationTime: 8,
    ingredients: ["Dark chocolate", "Butter", "Eggs", "Sugar", "Flour", "Vanilla ice cream"],
    allergens: ["Dairy", "Eggs", "Gluten"],
    isVeg: true,
    isVegan: false,
    isGlutenFree: false,
    spiceLevel: "NONE"
  },
  {
    id: "item_10",
    name: "Fresh Fruit Salad",
    description: "Seasonal fresh fruits with honey and mint",
    price: 129,
    image: "/images/menu/fruit-salad.jpg",
    categoryId: "cat_3",
    category: { id: "cat_3", name: "Desserts" },
    available: true,
    preparationTime: 5,
    ingredients: ["Seasonal fruits", "Honey", "Fresh mint", "Lime juice"],
    allergens: [],
    isVeg: true,
    isVegan: true,
    isGlutenFree: true,
    spiceLevel: "NONE"
  },

  // Beverages
  {
    id: "item_11",
    name: "Masala Chai",
    description: "Traditional Indian spiced tea with milk and aromatic spices",
    price: 79,
    image: "/images/menu/masala-chai.jpg",
    categoryId: "cat_4",
    category: { id: "cat_4", name: "Beverages" },
    available: true,
    preparationTime: 5,
    ingredients: ["Tea leaves", "Milk", "Sugar", "Cardamom", "Cinnamon", "Ginger"],
    allergens: ["Dairy"],
    isVeg: true,
    isVegan: false,
    isGlutenFree: true,
    spiceLevel: "NONE"
  },
  {
    id: "item_12",
    name: "Fresh Lime Soda",
    description: "Refreshing lime drink with soda water and a hint of salt",
    price: 89,
    image: "/images/menu/lime-soda.jpg",
    categoryId: "cat_4",
    category: { id: "cat_4", name: "Beverages" },
    available: true,
    preparationTime: 3,
    ingredients: ["Fresh lime", "Soda water", "Salt", "Sugar", "Ice"],
    allergens: [],
    isVeg: true,
    isVegan: true,
    isGlutenFree: true,
    spiceLevel: "NONE"
  },
  {
    id: "item_13",
    name: "Mango Lassi",
    description: "Creamy yogurt drink blended with sweet mango pulp",
    price: 119,
    image: "/images/menu/mango-lassi.jpg",
    categoryId: "cat_4",
    category: { id: "cat_4", name: "Beverages" },
    available: true,
    preparationTime: 4,
    ingredients: ["Yogurt", "Mango pulp", "Sugar", "Cardamom", "Ice"],
    allergens: ["Dairy"],
    isVeg: true,
    isVegan: false,
    isGlutenFree: true,
    spiceLevel: "NONE"
  },
  {
    id: "item_14",
    name: "Filter Coffee",
    description: "South Indian style filter coffee with milk and sugar",
    price: 69,
    image: "/images/menu/filter-coffee.jpg",
    categoryId: "cat_4",
    category: { id: "cat_4", name: "Beverages" },
    available: true,
    preparationTime: 4,
    ingredients: ["Coffee beans", "Milk", "Sugar"],
    allergens: ["Dairy"],
    isVeg: true,
    isVegan: false,
    isGlutenFree: true,
    spiceLevel: "NONE"
  }
];

export const sampleTables = [
  {
    id: "table_1",
    number: 1,
    capacity: 2,
    location: "Window side",
    active: true
  },
  {
    id: "table_2", 
    number: 2,
    capacity: 4,
    location: "Center area",
    active: true
  },
  {
    id: "table_3",
    number: 3,
    capacity: 6,
    location: "Corner booth",
    active: true
  },
  {
    id: "table_4",
    number: 4,
    capacity: 2,
    location: "Window side",
    active: true
  },
  {
    id: "table_5",
    number: 5,
    capacity: 4,
    location: "Garden area",
    active: true
  },
  {
    id: "table_6",
    number: 6,
    capacity: 8,
    location: "Private dining",
    active: true
  },
  {
    id: "table_7",
    number: 7,
    capacity: 4,
    location: "Center area",
    active: true
  },
  {
    id: "table_8",
    number: 8,
    capacity: 2,
    location: "Bar seating",
    active: true
  }
];

export const sampleUsers = [
  {
    id: "user_1",
    email: "admin@restaurant.com",
    name: "Restaurant Admin",
    phone: "+91 98765 43210",
    role: "ADMIN" as const,
    verified: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    // Test password: admin123
    password: "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiTNFm0NcRwW" // bcrypt hash
  },
  {
    id: "user_2",
    email: "customer@example.com", 
    name: "John Doe",
    phone: "+91 98765 43211",
    role: "CUSTOMER" as const,
    verified: true,
    createdAt: "2024-01-15T00:00:00.000Z",
    // Test password: customer123
    password: "$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi" // bcrypt hash
  },
  {
    id: "user_3",
    email: "jane@example.com",
    name: "Jane Smith", 
    phone: "+91 98765 43212",
    role: "CUSTOMER" as const,
    verified: true,
    createdAt: "2024-02-01T00:00:00.000Z",
    // Test password: jane123
    password: "$2a$12$YKHcVVy2lC4.RVKvTXQz2uJHxaKxT5Xj1BH9WJ8jKnZJZ8KbTJZ.K" // bcrypt hash
  }
];

// Test Login Credentials for Development
export const testCredentials = {
  admin: {
    email: "admin@restaurant.com",
    password: "admin123",
    role: "ADMIN",
    description: "Full admin access - can manage menu, orders, tables"
  },
  customer1: {
    email: "customer@example.com",
    password: "customer123", 
    role: "CUSTOMER",
    description: "Regular customer - can browse menu and place orders"
  },
  customer2: {
    email: "jane@example.com",
    password: "jane123",
    role: "CUSTOMER", 
    description: "Another customer account for testing"
  }
};

export const sampleOrders = [
  {
    id: "order_1",
    userId: "user_2",
    tableId: "table_2",
    status: "COMPLETED" as const,
    paymentStatus: "COMPLETED" as const,
    subtotal: 748,
    tax: 134.64,
    total: 882.64,
    paymentId: "pay_test_123",
    estimatedTime: 25,
    createdAt: "2024-01-20T18:30:00.000Z",
    items: [
      {
        id: "order_item_1",
        menuItemId: "item_4",
        quantity: 1,
        price: 449,
        menuItem: sampleMenuItems.find(item => item.id === "item_4")
      },
      {
        id: "order_item_2", 
        menuItemId: "item_5",
        quantity: 1,
        price: 299,
        menuItem: sampleMenuItems.find(item => item.id === "item_5")
      }
    ],
    table: sampleTables.find(table => table.id === "table_2"),
    user: sampleUsers.find(user => user.id === "user_2")
  },
  {
    id: "order_2",
    userId: "user_3", 
    tableId: "table_1",
    status: "PREPARING" as const,
    paymentStatus: "COMPLETED" as const,
    subtotal: 498,
    tax: 89.64,
    total: 587.64,
    paymentId: "pay_test_456",
    estimatedTime: 15,
    createdAt: "2024-01-21T12:15:00.000Z",
    items: [
      {
        id: "order_item_3",
        menuItemId: "item_1",
        quantity: 1,
        price: 299,
        menuItem: sampleMenuItems.find(item => item.id === "item_1")
      },
      {
        id: "order_item_4",
        menuItemId: "item_8", 
        quantity: 1,
        price: 149,
        menuItem: sampleMenuItems.find(item => item.id === "item_8")
      },
      {
        id: "order_item_5",
        menuItemId: "item_11",
        quantity: 2,
        price: 79,
        menuItem: sampleMenuItems.find(item => item.id === "item_11")
      }
    ],
    table: sampleTables.find(table => table.id === "table_1"),
    user: sampleUsers.find(user => user.id === "user_3")
  }
];

// Enhanced categories with menu items included
export const sampleCategoriesWithItems = sampleCategories.map(category => ({
  ...category,
  menuItems: sampleMenuItems.filter(item => item.categoryId === category.id)
}));

// Helper functions for development
export const getCategoryById = (id: string) => {
  return sampleCategories.find(category => category.id === id);
};

export const getMenuItemById = (id: string) => {
  return sampleMenuItems.find(item => item.id === id);
};

export const getTableById = (id: string) => {
  return sampleTables.find(table => table.id === id);
};

export const getUserById = (id: string) => {
  return sampleUsers.find(user => user.id === id);
};

export const getMenuItemsByCategory = (categoryId: string) => {
  return sampleMenuItems.filter(item => item.categoryId === categoryId);
};

export const getVegetarianItems = () => {
  return sampleMenuItems.filter(item => item.isVeg);
};

export const getVeganItems = () => {
  return sampleMenuItems.filter(item => item.isVegan);
};

export const getGlutenFreeItems = () => {
  return sampleMenuItems.filter(item => item.isGlutenFree);
};

export const getItemsBySpiceLevel = (spiceLevel: string) => {
  return sampleMenuItems.filter(item => item.spiceLevel === spiceLevel);
};

export const getAvailableTables = () => {
  return sampleTables.filter(table => table.active);
};

export const getTablesByCapacity = (minCapacity: number) => {
  return sampleTables.filter(table => table.capacity >= minCapacity && table.active);
};

// Mock API response format
export const mockApiResponse = {
  categories: sampleCategoriesWithItems,
  menuItems: sampleMenuItems,
  tables: sampleTables,
  users: sampleUsers,
  orders: sampleOrders
};

export default {
  categories: sampleCategories,
  menuItems: sampleMenuItems,
  tables: sampleTables,
  users: sampleUsers,
  orders: sampleOrders,
  categoriesWithItems: sampleCategoriesWithItems,
  helpers: {
    getCategoryById,
    getMenuItemById,
    getTableById,
    getUserById,
    getMenuItemsByCategory,
    getVegetarianItems,
    getVeganItems,
    getGlutenFreeItems,
    getItemsBySpiceLevel,
    getAvailableTables,
    getTablesByCapacity
  },
  mockApiResponse
};