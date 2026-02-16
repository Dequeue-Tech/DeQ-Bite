import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate } from '@/middleware/auth';
import { authorizeRestaurantRole, requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest, ApiResponse } from '@/types/api';

const router = Router();

const createRestaurantSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(60),
  subdomain: z.string().min(2).max(60),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const addRestaurantUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'STAFF']),
});

// GET /api/restaurants/public/search?query=abc - public list for central user page
router.get('/public/search', async (req: AuthenticatedRequest, res: Response) => {
  const query = (req.query['query'] as string | undefined)?.trim() || '';

  const restaurants = await prisma.restaurant.findMany({
    where: {
      active: true,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { slug: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      subdomain: true,
      address: true,
    },
    orderBy: { name: 'asc' },
    take: 50,
  });

  const response: ApiResponse = {
    success: true,
    data: { restaurants },
  };
  res.json(response);
});

// GET /api/restaurants/current - resolve current restaurant from subdomain
router.get('/current', requireRestaurant, async (req: AuthenticatedRequest, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: { restaurant: req.restaurant },
  };
  res.json(response);
});

// GET /api/restaurants/mine - list restaurants for current user
router.get('/mine', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const restaurants = await prisma.restaurantUser.findMany({
    where: {
      userId: req.user!.id,
      active: true,
    },
    include: {
      restaurant: true,
    },
  });

  const response: ApiResponse = {
    success: true,
    data: {
      restaurants: restaurants.map((entry) => ({
        id: entry.restaurant.id,
        name: entry.restaurant.name,
        slug: entry.restaurant.slug,
        subdomain: entry.restaurant.subdomain,
        role: entry.role,
      })),
    },
  };
  res.json(response);
});

// POST /api/restaurants - create a new restaurant and set current user as OWNER
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const payload = createRestaurantSchema.parse(req.body);
  const slug = payload.slug.trim().toLowerCase();
  const subdomain = payload.subdomain.trim().toLowerCase();

  const existing = await prisma.restaurant.findFirst({
    where: {
      OR: [{ slug }, { subdomain }],
    },
  });

  if (existing) {
    res.status(409).json({
      success: false,
      error: 'Restaurant with this slug or subdomain already exists',
    });
    return;
  }

  const restaurant = await prisma.$transaction(async (tx) => {
    const created = await tx.restaurant.create({
      data: {
        name: payload.name,
        slug,
        subdomain,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        address: payload.address ?? null,
      },
    });

    await tx.restaurantUser.create({
      data: {
        restaurantId: created.id,
        userId: req.user!.id,
        role: 'OWNER',
      },
    });

    return created;
  });

  const response: ApiResponse = {
    success: true,
    data: { restaurant },
    message: 'Restaurant created',
  };
  res.status(201).json(response);
  return;
});

// GET /api/restaurants/users - list users for current restaurant
router.get('/users', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const users = await prisma.restaurantUser.findMany({
    where: {
      restaurantId: req.restaurant!.id,
      active: true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const response: ApiResponse = {
    success: true,
    data: {
      users: users.map((entry) => ({
        membershipId: entry.id,
        role: entry.role,
        active: entry.active,
        user: entry.user,
      })),
    },
  };

  res.json(response);
});

// POST /api/restaurants/users - add existing user to current restaurant as OWNER/ADMIN/STAFF
router.post('/users', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const payload = addRestaurantUserSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email: payload.email },
    select: { id: true },
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found. Ask them to sign up first.',
    });
  }

  const membership = await prisma.restaurantUser.upsert({
    where: {
      restaurantId_userId: {
        restaurantId: req.restaurant!.id,
        userId: user.id,
      },
    },
    update: {
      role: payload.role,
      active: true,
    },
    create: {
      restaurantId: req.restaurant!.id,
      userId: user.id,
      role: payload.role,
      active: true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  return res.status(201).json({
    success: true,
    data: {
      membership: {
        id: membership.id,
        role: membership.role,
        active: membership.active,
        user: membership.user,
      },
    },
    message: 'Restaurant user added/updated successfully',
  });
});

export default router;
