"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var bcryptjs_1 = require("bcryptjs");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var hashedPassword, admin, categories, menuItems, tables;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🌱 Starting database seeding...');
                    return [4 /*yield*/, bcryptjs_1.default.hash('admin123', 10)];
                case 1:
                    hashedPassword = _a.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'admin@restaurant.com' },
                            update: {},
                            create: {
                                email: 'admin@restaurant.com',
                                name: 'Restaurant Admin',
                                password: hashedPassword,
                                role: client_1.UserRole.ADMIN,
                                verified: true,
                            },
                        })];
                case 2:
                    admin = _a.sent();
                    return [4 /*yield*/, Promise.all([
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
                        ])];
                case 3:
                    categories = _a.sent();
                    return [4 /*yield*/, Promise.all([
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
                                    spiceLevel: client_1.SpiceLevel.MILD,
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
                                    spiceLevel: client_1.SpiceLevel.HOT,
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
                                    spiceLevel: client_1.SpiceLevel.MILD,
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
                                    spiceLevel: client_1.SpiceLevel.MILD,
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
                                    spiceLevel: client_1.SpiceLevel.NONE,
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
                                    spiceLevel: client_1.SpiceLevel.NONE,
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
                                    spiceLevel: client_1.SpiceLevel.NONE,
                                },
                            }),
                        ])];
                case 4:
                    menuItems = _a.sent();
                    return [4 /*yield*/, Promise.all([
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
                        ])];
                case 5:
                    tables = _a.sent();
                    console.log('✅ Database seeded successfully!');
                    console.log("Created admin user: ".concat(admin.email));
                    console.log("Created ".concat(categories.length, " categories"));
                    console.log("Created ".concat(menuItems.length, " menu items"));
                    console.log("Created ".concat(tables.length, " tables"));
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!(process.env.IS_SERVERLESS !== 'true')) return [3 /*break*/, 2];
                return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                _a.label = 2;
            case 2: return [2 /*return*/];
        }
    });
}); });
