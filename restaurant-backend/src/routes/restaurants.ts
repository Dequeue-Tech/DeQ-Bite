import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { Prisma } from '@prisma/client';
import { authenticate } from '@/middleware/auth';
import { authorizeRestaurantRole, requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest, ApiResponse } from '@/types/api';

const router = Router();

// determine at runtime whether prisma client has the `status` field on Restaurant
// PrismaClient does not expose `_dmmf` in the types, cast to any to
// inspect the generated schema at runtime. This helps when deployments may
// still be running an older client that lacks the `status` field.
const hasRestaurantStatus =
  !!(prisma as any)._dmmf?.modelMap?.Restaurant?.fields?.some((f: any) => f.name === 'status');

// determine which restaurant fields actually exist in the generated client
const restaurantFields: string[] =
  ((prisma as any)._dmmf?.modelMap?.Restaurant?.fields || []).map((f: any) => f.name);

function pickFields(fields: string[]) {
  const out: any = {};
  for (const f of fields) {
    if (restaurantFields.includes(f)) {
      out[f] = true;
    }
  }
  return out;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const ensureUniqueRestaurantHandles = async (name: string) => {
  const base = slugify(name) || 'restaurant';
  let suffix = 0;

  while (true) {
    const candidate = suffix === 0 ? base : `${base}-${suffix}`;
    const exists = await prisma.restaurant.findFirst({
      where: {
        OR: [{ slug: candidate }, { subdomain: candidate }],
      },
      select: { id: true },
    });

    if (!exists) {
      return { slug: candidate, subdomain: candidate };
    }

    suffix += 1;
  }
};

const createRestaurantSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  cuisineTypes: z.array(z.string().min(2).max(40)).max(10).optional(),
});

const updatePaymentPolicySchema = z.object({
  paymentCollectionTiming: z.enum(['BEFORE_MEAL', 'AFTER_MEAL']),
  cashPaymentEnabled: z.boolean(),
});

const addRestaurantUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'STAFF']),
});

// GET /api/restaurants/public/search?query=abc&cuisine=indian&location=city
router.get('/public/search', async (req: AuthenticatedRequest, res: Response) => {
  const query = (req.query['query'] as string | undefined)?.trim() || '';
  const cuisine = (req.query['cuisine'] as string | undefined)?.trim();
  const location = (req.query['location'] as string | undefined)?.trim();

  // build the base filter for the search
  const baseFilter: Prisma.RestaurantWhereInput = {
    active: true,
    ...(hasRestaurantStatus ? { status: 'APPROVED' } : {}),
    ...(query ? { name: { contains: query, mode: 'insensitive' } } : {}),
    ...(cuisine ? { cuisineTypes: { has: cuisine } } : {}),
    ...(location
      ? {
          OR: [
            { city: { contains: location, mode: 'insensitive' } },
            { state: { contains: location, mode: 'insensitive' } },
            { address: { contains: location, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const searchSelect = pickFields([
    'id',
    'name',
    'slug',
    'subdomain',
    'address',
    'city',
    'state',
    'cuisineTypes',
    'paymentCollectionTiming',
    'cashPaymentEnabled',
  ]);

  let restaurants;
  try {
    restaurants = await prisma.restaurant.findMany({
      where: baseFilter,
      select: searchSelect,
      orderBy: { name: 'asc' },
      take: 50,
    });
  } catch (err: any) {
    const isStatusError =
      err instanceof Prisma.PrismaClientValidationError ||
      (err.message && err.message.includes('Unknown argument `status`'));
    if (isStatusError) {
      // drop the status check and retry
      console.warn('Prisma schema mismatch in search, retrying without status filter');
      const fallback = { ...baseFilter };
      delete (fallback as any).status;
      restaurants = await prisma.restaurant.findMany({
        where: fallback,
        select: searchSelect,
        orderBy: { name: 'asc' },
        take: 50,
      });
    } else {
      throw err;
    }
  }

  const response: ApiResponse = {
    success: true,
    data: {
      restaurants,
    },
  };

  res.json(response);
});

// GET /api/restaurants/public/:identifier
router.get('/public/:identifier', async (req: AuthenticatedRequest, res: Response) => {
  const identifier = req.params['identifier'];

  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Restaurant identifier is required' });
  }

  const baseFilter: Prisma.RestaurantWhereInput = {
    active: true,
    ...(hasRestaurantStatus ? { status: 'APPROVED' } : {}),
    OR: [{ id: identifier }, { slug: identifier }, { subdomain: identifier }],
  };

  let restaurant;
  const detailSelect = pickFields([
    'id',
    'name',
    'slug',
    'subdomain',
    'address',
    'city',
    'state',
    'country',
    'email',
    'phone',
    'cuisineTypes',
    'paymentCollectionTiming',
    'cashPaymentEnabled',
  ]);
  // add nested selects manually (categories/menuItems)
  detailSelect.categories = {
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  };
  detailSelect.menuItems = {
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
  };

  try {
    restaurant = await prisma.restaurant.findFirst({
      where: baseFilter,
      select: detailSelect,
    });
  } catch (err: any) {
    const isStatusError =
      err instanceof Prisma.PrismaClientValidationError ||
      (err.message && err.message.includes('Unknown argument `status`'));
    if (isStatusError) {
      console.warn(
        'Prisma schema mismatch fetching single restaurant, retrying without status filter'
      );
      const fallback = { ...baseFilter };
      delete (fallback as any).status;
      restaurant = await prisma.restaurant.findFirst({
        where: fallback,
        select: detailSelect,
      });
    } else {
      throw err;
    }
  }

  if (!restaurant) {
    return res.status(404).json({ success: false, error: 'Restaurant not found' });
  }

  return res.json({
    success: true,
    data: {
      restaurant,
    },
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
  const mineSelect: any = pickFields([
    'id',
    'name',
    'slug',
    'subdomain',
    'paymentCollectionTiming',
    'cashPaymentEnabled',
  ]);
  if (hasRestaurantStatus) {
    mineSelect.status = true;
  }

  const restaurants = await prisma.restaurantUser.findMany({
    where: {
      userId: req.user!.id,
      active: true,
    },
    include: {
      restaurant: {
        select: mineSelect,
      },
    },
  });

  const response: ApiResponse = {
    success: true,
    data: {
      restaurants: restaurants.map((entry: any) => ({
        id: entry.restaurant.id,
        name: entry.restaurant.name,
        slug: entry.restaurant.slug,
        subdomain: entry.restaurant.subdomain,
        status: entry.restaurant.status,
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
  const handles = await ensureUniqueRestaurantHandles(payload.name);

  const createSelect: any = pickFields([
    'id',
    'name',
    'slug',
    'subdomain',
    'address',
    'email',
    'phone',
    'active',
    'paymentCollectionTiming',
    'cashPaymentEnabled',
    'createdAt',
    'updatedAt',
  ]);
  if (hasRestaurantStatus) createSelect.status = true;

  const restaurant: any = await prisma.restaurant.create({
    data: {
      name: payload.name,
      slug: handles.slug,
      subdomain: handles.subdomain,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      address: payload.address ?? null,
      city: payload.city ?? null,
      state: payload.state ?? null,
      country: payload.country ?? null,
      cuisineTypes: payload.cuisineTypes ?? [],
      active: true,
      ...(hasRestaurantStatus ? { status: 'APPROVED' } : {}),
      approvedAt: new Date(),
      approvedByUserId: req.user!.id,
    },
    select: createSelect,
  });

  await prisma.restaurantUser.create({
    data: {
      restaurantId: restaurant.id,
      userId: req.user!.id,
      role: 'OWNER',
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: req.user!.id,
      restaurantId: restaurant.id,
      action: 'RESTAURANT_CREATED',
      entityType: 'restaurant',
      entityId: restaurant.id,
      metadata: {
        slug: restaurant.slug,
        subdomain: restaurant.subdomain,
      },
    },
  });

  const response: ApiResponse = {
    success: true,
    data: { restaurant },
    message: 'Restaurant onboarded successfully',
  };

  res.status(201).json(response);
});

// GET /api/restaurants/settings/payment-policy
router.get('/settings/payment-policy', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const policySelect = pickFields([
    'id',
    'name',
    'paymentCollectionTiming',
    'cashPaymentEnabled',
  ]);
  const restaurant: any = await prisma.restaurant.findUnique({
    where: { id: req.restaurant!.id },
    select: policySelect,
  });

  return res.json({
    success: true,
    data: { paymentPolicy: restaurant },
  });
});

// PUT /api/restaurants/settings/payment-policy
router.put('/settings/payment-policy', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const payload = updatePaymentPolicySchema.parse(req.body);

  const policySelect = pickFields([
    'id',
    'name',
    'paymentCollectionTiming',
    'cashPaymentEnabled',
  ]);
  const restaurant: any = await prisma.restaurant.update({
    where: { id: req.restaurant!.id },
    data: {
      paymentCollectionTiming: payload.paymentCollectionTiming,
      cashPaymentEnabled: payload.cashPaymentEnabled,
    },
    select: policySelect,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: req.user!.id,
      restaurantId: req.restaurant!.id,
      action: 'PAYMENT_POLICY_UPDATED',
      entityType: 'restaurant',
      entityId: req.restaurant!.id,
      metadata: payload,
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
      users: users.map((entry: {
        id: string;
        role: string;
        active: boolean;
        user: {
          id: string;
          name: string;
          email: string;
          phone: string | null;
          role: 'CUSTOMER' | 'OWNER' | 'ADMIN' | 'STAFF' | 'CENTRAL_ADMIN' | 'KITCHEN_STAFF';
          createdAt: Date;
        };
      }) => ({
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

  await prisma.auditLog.create({
    data: {
      actorUserId: req.user!.id,
      restaurantId: req.restaurant!.id,
      action: 'RESTAURANT_USER_UPSERT',
      entityType: 'restaurant_user',
      entityId: membership.id,
      metadata: {
        userId: membership.userId,
        role: membership.role,
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
