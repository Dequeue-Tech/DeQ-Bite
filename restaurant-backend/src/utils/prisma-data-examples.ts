import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { ApiResponse } from '../types/api';

/**
 * Test endpoint to demonstrate comprehensive Prisma data fetching
 * This shows how to fetch user data with related orders, statistics, and calculations
 * All data comes directly from Prisma database, not custom logic
 */
export const getUserWithCompleteData = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  // Comprehensive user data fetching from Prisma
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      // Include related orders with full details
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
      // Count related data
      _count: {
        select: {
          orders: true,
        },
      },
    },
  });

  if (!userData) {
    throw new AppError('User not found', 404);
  }

  // Use Prisma aggregation to calculate user statistics
  const userStats = await prisma.order.groupBy({
    by: ['paymentStatus'],
    where: { userId },
    _count: {
      id: true,
    },
    _sum: {
      total: true,
    },
  });

  // Get user's favorite menu items using Prisma
  const favoriteItems = await prisma.orderItem.groupBy({
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

  // Fetch menu item details for favorites
  const favoriteMenuItems = await prisma.menuItem.findMany({
    where: {
      id: {
        in: favoriteItems.map(item => item.menuItemId),
      },
    },
    include: {
      category: true,
    },
  });

  // Calculate spending patterns by month using Prisma
  const spendingPattern = await prisma.order.groupBy({
    by: ['createdAt'],
    where: {
      userId,
      paymentStatus: 'COMPLETED',
    },
    _sum: {
      total: true,
    },
    _count: {
      id: true,
    },
  });

  // Process monthly spending (this would typically be done with raw SQL for better date grouping)
  const monthlySpending = spendingPattern.reduce((acc: any, order) => {
    const month = new Date(order.createdAt).toISOString().slice(0, 7); // YYYY-MM format
    if (!acc[month]) {
      acc[month] = { total: 0, count: 0 };
    }
    acc[month].total += order._sum.total || 0;
    acc[month].count += order._count.id;
    return acc;
  }, {});

  const response: ApiResponse = {
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
        totalSpent: userStats.reduce((sum, stat) => sum + (stat._sum.total || 0), 0),
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
          ? userData.orders.reduce((sum, order) => sum + order.total, 0) / userData.orders.length 
          : 0,
      },
    },
  };

  res.json(response);
});

/**
 * Example of fetching menu data with comprehensive Prisma relations
 */
export const getMenuWithCompleteData = asyncHandler(async (_req: Request, res: Response) => {
  const menuData = await prisma.category.findMany({
    include: {
      menuItems: {
        where: { available: true },
        include: {
          // Include order statistics for each menu item
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

  // Calculate popularity for each menu item
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
        price: item.price,
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
        // Calculated fields from Prisma data
        popularity: totalOrdered,
        trending: totalOrdered > 10, // Example logic
      };
    }),
  }));

  const response: ApiResponse = {
    success: true,
    data: {
      categories: enhancedMenuData,
      summary: {
        totalCategories: menuData.length,
        totalItems: menuData.reduce((sum, cat) => sum + cat.menuItems.length, 0),
        availableItems: menuData.reduce((sum, cat) => 
          sum + cat.menuItems.filter(item => item.available).length, 0),
      },
    },
  };

  res.json(response);
});