import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate } from '@/middleware/auth';
import { AppError, asyncHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest, ApiResponse } from '@/types/api';

const router = Router();

const firebaseSessionSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50).optional(),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').optional(),
});

// Legacy endpoints retained for backwards compatibility.
router.post('/register', asyncHandler(async (_req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    message: 'This endpoint is deprecated. Use Firebase Authentication on the client, then call /api/auth/session with a Firebase ID token.',
  };

  res.status(410).json(response);
}));

// Legacy endpoints retained for backwards compatibility.
router.post('/login', asyncHandler(async (_req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    message: 'This endpoint is deprecated. Use Firebase Authentication on the client, then call /api/auth/session with a Firebase ID token.',
  };

  res.status(410).json(response);
}));

// POST /api/auth/session - Sync Firebase-authenticated user profile
router.post('/session', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const payload = firebaseSessionSchema.parse(req.body ?? {});
  const userId = req.user!.id;

  if (payload.phone) {
    const phoneOwner = await prisma.user.findFirst({
      where: {
        phone: payload.phone,
        NOT: { id: userId },
      },
      select: { id: true },
    });

    if (phoneOwner) {
      throw new AppError('Phone number is already in use by another account', 409);
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.phone ? { phone: payload.phone } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      verified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const response: ApiResponse = {
    success: true,
    message: 'Session synchronized successfully',
    data: { user },
  };

  res.json(response);
}));

// GET /api/auth/me - Enhanced with comprehensive user data
router.get('/me', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      verified: true,
      createdAt: true,
      updatedAt: true,
      // Include recent orders
      orders: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          totalPaise: true,
          createdAt: true,
          table: {
            select: {
              number: true,
              location: true,
            },
          },
        },
      },
      // Count total orders
      _count: {
        select: {
          orders: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  let restaurantRole: string | null = null;
  if (req.restaurant) {
    const membership = await prisma.restaurantUser.findUnique({
      where: {
        restaurantId_userId: {
          restaurantId: req.restaurant.id,
          userId: req.user!.id,
        },
      },
      select: { role: true, active: true },
    });
    if (membership?.active) {
      restaurantRole = membership.role;
    }
  }

  const response: ApiResponse = {
    success: true,
    data: { 
      user: {
        ...user,
        totalOrders: user._count.orders,
        recentOrders: user.orders,
        restaurantRole,
      },
    },
  };

  res.json(response);
}));

// GET /api/auth/profile - Enhanced profile with comprehensive data
router.get('/profile', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userProfile = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      verified: true,
      createdAt: true,
      updatedAt: true,
      // Recent orders with detailed information
      orders: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          totalPaise: true,
          createdAt: true,
          table: {
            select: {
              number: true,
              location: true,
            },
          },
          items: {
            select: {
              quantity: true,
              pricePaise: true,
              menuItem: {
                select: {
                  name: true,
                  category: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      // Order statistics
      _count: {
        select: {
          orders: true,
        },
      },
    },
  });

  if (!userProfile) {
    throw new AppError('User profile not found', 404);
  }

  let restaurantRole: string | null = null;
  if (req.restaurant) {
    const membership = await prisma.restaurantUser.findUnique({
      where: {
        restaurantId_userId: {
          restaurantId: req.restaurant.id,
          userId: req.user!.id,
        },
      },
      select: { role: true, active: true },
    });
    if (membership?.active) {
      restaurantRole = membership.role;
    }
  }

  // Calculate total spent from Prisma
  const totalSpent = await prisma.order.aggregate({
    where: {
      userId: req.user!.id,
      paymentStatus: 'COMPLETED',
    },
    _sum: {
      totalPaise: true,
    },
  });

  const response: ApiResponse = {
    success: true,
    data: {
      user: {
        ...userProfile,
        totalOrders: userProfile._count.orders,
        totalSpent: totalSpent._sum.totalPaise || 0,
        recentOrders: userProfile.orders,
        restaurantRole,
      },
    },
  };

  res.json(response);
}));

// PUT /api/auth/change-password
router.put('/change-password', authenticate, asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const response: ApiResponse = {
    success: false,
    message: 'Password changes are managed by Firebase Authentication. Use Firebase reset/update flows on the client.',
  };

  res.status(410).json(response);
}));

// POST /api/auth/refresh
router.post('/refresh', authenticate, asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const response: ApiResponse = {
    success: false,
    message: 'Token refresh is managed by Firebase Authentication. Fetch a fresh Firebase ID token on the client.',
  };

  res.status(410).json(response);
}));

export default router;
