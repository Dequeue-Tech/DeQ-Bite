import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate } from '@/middleware/auth';
import { authorizeRestaurantRole, requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest, ApiResponse } from '@/types/api';

const router = Router();

const createRestaurantSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const updatePaymentPolicySchema = z.object({
  paymentCollectionTiming: z.enum(['BEFORE_MEAL', 'AFTER_MEAL']),
  cashPaymentEnabled: z.boolean(),
});

const addRestaurantUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'STAFF']),
});

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

const generateRestaurantKeys = async (name: string) => {
  const base = slugify(name) || 'restaurant';

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${Math.random().toString(36).slice(2, 6)}`;
    const candidate = `${base}${suffix}`.slice(0, 60);

    const existing = await prisma.restaurant.findFirst({
      where: {
        OR: [{ slug: candidate }, { subdomain: candidate }],
      },
      select: { id: true },
    });

    if (!existing) {
      return { slug: candidate, subdomain: candidate };
    }
  }

  throw new Error('Unable to generate unique restaurant key');
};

// GET /api/restaurants/public/search?query=abc
router.get('/public/search', async (req: AuthenticatedRequest, res: Response) => {
  const query = (req.query['query'] as string | undefined)?.trim() || '';

  const restaurants = await prisma.restaurant.findMany({
    where: {
      active: true,
      ...(query ? { name: { contains: query, mode: 'insensitive' } } : {}),
    },
    select: {
      id: true,
      name: true,
      subdomain: true,
      address: true,
      paymentCollectionTiming: true,
      cashPaymentEnabled: true,
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

// GET /api/restaurants/public/:id
router.get('/public/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, error: 'Restaurant id is required' });
  }

  const restaurant = await prisma.restaurant.findFirst({
    where: { id, active: true },
    select: {
      id: true,
      name: true,
      subdomain: true,
      address: true,
      email: true,
      phone: true,
      paymentCollectionTiming: true,
      cashPaymentEnabled: true,
      categories: {
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true },
      },
      menuItems: {
        where: { available: true },
        take: 12,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          pricePaise: true,
          isVeg: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!restaurant) {
    return res.status(404).json({ success: false, error: 'Restaurant not found' });
  }

  return res.json({
    success: true,
    data: { restaurant },
  });
});

// GET /api/restaurants/current
router.get('/current', requireRestaurant, async (req: AuthenticatedRequest, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: { restaurant: req.restaurant },
  };

  res.json(response);
});

// GET /api/restaurants/mine
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
        subdomain: entry.restaurant.subdomain,
        role: entry.role,
        paymentCollectionTiming: entry.restaurant.paymentCollectionTiming,
        cashPaymentEnabled: entry.restaurant.cashPaymentEnabled,
      })),
    },
  };

  res.json(response);
});

// POST /api/restaurants
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const payload = createRestaurantSchema.parse(req.body);
  const keys = await generateRestaurantKeys(payload.name);

  const restaurant = await prisma.$transaction(async (tx) => {
    const created = await tx.restaurant.create({
      data: {
        name: payload.name,
        slug: keys.slug,
        subdomain: keys.subdomain,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        address: payload.address ?? null,
        paymentCollectionTiming: 'AFTER_MEAL',
        cashPaymentEnabled: true,
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
});

// GET /api/restaurants/settings/payment-policy
router.get('/settings/payment-policy', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.restaurant!.id },
    select: {
      id: true,
      name: true,
      paymentCollectionTiming: true,
      cashPaymentEnabled: true,
    },
  });

  return res.json({
    success: true,
    data: { paymentPolicy: restaurant },
  });
});

// PUT /api/restaurants/settings/payment-policy
router.put('/settings/payment-policy', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const payload = updatePaymentPolicySchema.parse(req.body);

  const restaurant = await prisma.restaurant.update({
    where: { id: req.restaurant!.id },
    data: {
      paymentCollectionTiming: payload.paymentCollectionTiming,
      cashPaymentEnabled: payload.cashPaymentEnabled,
    },
    select: {
      id: true,
      name: true,
      paymentCollectionTiming: true,
      cashPaymentEnabled: true,
    },
  });

  return res.json({
    success: true,
    message: 'Payment policy updated',
    data: { paymentPolicy: restaurant },
  });
});

// GET /api/restaurants/users
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

// POST /api/restaurants/users
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
