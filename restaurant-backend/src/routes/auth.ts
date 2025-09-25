import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate } from '@/middleware/auth'; 
import { AppError, asyncHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest, ApiResponse } from '@/types/api';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['CUSTOMER', 'ADMIN']).optional().default('CUSTOMER'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

// Helper function to generate JWT token
const generateToken = (userId: string): string => {
  const jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    throw new AppError('JWT_SECRET environment variable is not configured', 500);
  }
  
  const payload = { id: userId };
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  
  return jwt.sign(payload, jwtSecret, { expiresIn });
};

// POST /api/auth/register
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone, password, role } = registerSchema.parse(req.body);

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        ...(phone ? [{ phone }] : []),
      ],
    },
  });

  if (existingUser) {
    throw new AppError('User with this email or phone already exists', 409);
  }

  // Hash password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create user
  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      password: hashedPassword,
      role: role as 'CUSTOMER' | 'ADMIN',
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      verified: true,
      createdAt: true,
    },
  });

  // Generate token
  const token = generateToken(user.id);

  const response: ApiResponse = {
    success: true,
    message: 'User registered successfully',
    data: {
      user,
      token,
    },
  };

  res.status(201).json(response);
}));

// POST /api/auth/login
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  // Find user with comprehensive data from Prisma
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      orders: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          total: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  // Generate token
  const token = generateToken(user.id);

  const response: ApiResponse = {
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        verified: user.verified,
        createdAt: user.createdAt,
        recentOrders: user.orders,
      },
      token,
    },
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
          total: true,
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

  const response: ApiResponse = {
    success: true,
    data: { 
      user: {
        ...user,
        totalOrders: user._count.orders,
        recentOrders: user.orders,
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
          total: true,
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
              price: true,
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

  // Calculate total spent from Prisma
  const totalSpent = await prisma.order.aggregate({
    where: {
      userId: req.user!.id,
      paymentStatus: 'COMPLETED',
    },
    _sum: {
      total: true,
    },
  });

  const response: ApiResponse = {
    success: true,
    data: {
      user: {
        ...userProfile,
        totalOrders: userProfile._count.orders,
        totalSpent: totalSpent._sum.total || 0,
        recentOrders: userProfile.orders,
      },
    },
  };

  res.json(response);
}));

// PUT /api/auth/change-password
router.put('/change-password', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  // Get current user with password
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

  if (!isCurrentPasswordValid) {
    throw new AppError('Current password is incorrect', 400);
  }

  // Hash new password
  const saltRounds = 12;
  const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { password: hashedNewPassword },
  });

  const response: ApiResponse = {
    success: true,
    message: 'Password changed successfully',
  };

  res.json(response);
}));

// POST /api/auth/refresh
router.post('/refresh', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Generate new token
  const token = generateToken(req.user!.id);

  const response: ApiResponse = {
    success: true,
    message: 'Token refreshed successfully',
    data: { token },
  };

  res.json(response);
}));

export default router;