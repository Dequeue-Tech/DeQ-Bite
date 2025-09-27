import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getPrismaClient } from '../config/database'; // Use lazy initialization
import { authenticate } from '../middleware/auth'; 
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest, ApiResponse } from '../types/api';

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
  
  // Using explicit type casting for JWT secret and options
  return jwt.sign(payload, jwtSecret!, {
    expiresIn,
  } as jwt.SignOptions);
};

// POST /api/auth/register
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
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
  const prisma = getPrismaClient(); // Lazy initialization
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

// GET /api/auth/me - Simplified user data for faster response
router.get('/me', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
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
      // Remove complex nested queries for faster response
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const response: ApiResponse = {
    success: true,
    data: { 
      user,
    },
  };

  res.json(response);
}));

// GET /api/auth/profile - Keep comprehensive data but optimize queries
router.get('/profile', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
  // Split complex query into simpler ones for better performance
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
    },
  });

  if (!userProfile) {
    throw new AppError('User profile not found', 404);
  }

  // Get recent orders separately
  const recentOrders = await prisma.order.findMany({
    where: { userId: req.user!.id },
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
    },
  });

  // Get order count
  const orderCount = await prisma.order.count({
    where: { userId: req.user!.id },
  });

  // Calculate total spent
  const totalSpentResult = await prisma.order.aggregate({
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
        totalOrders: orderCount,
        totalSpent: totalSpentResult._sum.total || 0,
        recentOrders: recentOrders,
      },
    },
  };

  res.json(response);
}));

// PUT /api/auth/change-password
router.put('/change-password', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
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