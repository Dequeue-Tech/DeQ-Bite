"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMenuWithCompleteData = exports.getUserWithCompleteData = void 0;
const database_1 = require("@/config/database");
const errorHandler_1 = require("@/middleware/errorHandler");
exports.getUserWithCompleteData = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        throw new errorHandler_1.AppError('User ID is required', 400);
    }
    const userData = await database_1.prisma.user.findUnique({
        where: { id: userId },
        include: {
            orders: {
                include: {
                    items: {
                        include: {
                            menuItem: {
                                include: {
                                    category: true,
                                },
                            },
                        },
                    },
                    table: true,
                    invoice: true,
                },
                orderBy: { createdAt: 'desc' },
            },
            _count: {
                select: {
                    orders: true,
                },
            },
        },
    });
    if (!userData) {
        throw new errorHandler_1.AppError('User not found', 404);
    }
    const userStats = await database_1.prisma.order.groupBy({
        by: ['paymentStatus'],
        where: { userId },
        _count: {
            id: true,
        },
        _sum: {
            totalPaise: true,
        },
    });
    const favoriteItems = await database_1.prisma.orderItem.groupBy({
        by: ['menuItemId'],
        where: {
            order: {
                userId,
                paymentStatus: 'COMPLETED',
            },
        },
        _count: {
            menuItemId: true,
        },
        _sum: {
            quantity: true,
        },
        orderBy: {
            _sum: {
                quantity: 'desc',
            },
        },
        take: 5,
    });
    const favoriteMenuItems = await database_1.prisma.menuItem.findMany({
        where: {
            id: {
                in: favoriteItems.map(item => item.menuItemId),
            },
        },
        include: {
            category: true,
        },
    });
    const spendingPattern = await database_1.prisma.order.groupBy({
        by: ['createdAt'],
        where: {
            userId,
            paymentStatus: 'COMPLETED',
        },
        _sum: {
            totalPaise: true,
        },
        _count: {
            id: true,
        },
    });
    const monthlySpending = spendingPattern.reduce((acc, order) => {
        const month = new Date(order.createdAt).toISOString().slice(0, 7);
        if (!acc[month]) {
            acc[month] = { total: 0, count: 0 };
        }
        acc[month].total += order._sum.totalPaise || 0;
        acc[month].count += order._count.id;
        return acc;
    }, {});
    const response = {
        success: true,
        data: {
            user: {
                id: userData.id,
                name: userData.name,
                email: userData.email,
                phone: userData.phone,
                role: userData.role,
                verified: userData.verified,
                createdAt: userData.createdAt,
                updatedAt: userData.updatedAt,
                totalOrders: userData._count.orders,
                recentOrders: userData.orders.slice(0, 10),
            },
            statistics: {
                ordersByStatus: userStats,
                totalSpent: userStats.reduce((sum, stat) => sum + (stat._sum.totalPaise || 0), 0),
                completedOrders: userStats.find(s => s.paymentStatus === 'COMPLETED')?._count.id || 0,
            },
            preferences: {
                favoriteItems: favoriteMenuItems.map((item, index) => ({
                    ...item,
                    orderCount: favoriteItems[index]?._count.menuItemId || 0,
                    totalQuantity: favoriteItems[index]?._sum.quantity || 0,
                })),
            },
            analytics: {
                monthlySpending,
                averageOrderValue: userData.orders.length > 0
                    ? userData.orders.reduce((sum, order) => sum + order.totalPaise, 0) / userData.orders.length
                    : 0,
            },
        },
    };
    res.json(response);
});
exports.getMenuWithCompleteData = (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const menuData = await database_1.prisma.category.findMany({
        include: {
            menuItems: {
                where: { available: true },
                include: {
                    orderItems: {
                        select: {
                            quantity: true,
                            order: {
                                select: {
                                    paymentStatus: true,
                                },
                            },
                        },
                    },
                },
            },
        },
        orderBy: { sortOrder: 'asc' },
    });
    const enhancedMenuData = menuData.map(category => ({
        ...category,
        menuItems: category.menuItems.map(item => {
            const totalOrdered = item.orderItems.reduce((sum, orderItem) => {
                return orderItem.order.paymentStatus === 'COMPLETED' ? sum + orderItem.quantity : sum;
            }, 0);
            return {
                id: item.id,
                name: item.name,
                description: item.description,
                pricePaise: item.pricePaise,
                image: item.image,
                available: item.available,
                preparationTime: item.preparationTime,
                ingredients: item.ingredients,
                allergens: item.allergens,
                isVeg: item.isVeg,
                isVegan: item.isVegan,
                isGlutenFree: item.isGlutenFree,
                spiceLevel: item.spiceLevel,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
                popularity: totalOrdered,
                trending: totalOrdered > 10,
            };
        }),
    }));
    const response = {
        success: true,
        data: {
            categories: enhancedMenuData,
            summary: {
                totalCategories: menuData.length,
                totalItems: menuData.reduce((sum, cat) => sum + cat.menuItems.length, 0),
                availableItems: menuData.reduce((sum, cat) => sum + cat.menuItems.filter(item => item.available).length, 0),
            },
        },
    };
    res.json(response);
});
//# sourceMappingURL=prisma-data-examples.js.map