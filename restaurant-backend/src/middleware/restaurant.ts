import { Response, NextFunction } from 'express';
import { prisma } from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/types/api';

const isLocalHost = (host?: string | null) => {
  if (!host) return false;
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
};

const extractSubdomain = (host?: string | null): string | null => {
  if (!host) return null;
  const cleanHost = (host.split(':')[0] ?? '').toLowerCase();
  if (!cleanHost) return null;
  const baseDomain = (process.env['BASE_DOMAIN'] || '').toLowerCase();

  if (baseDomain && cleanHost.endsWith(`.${baseDomain}`)) {
    return cleanHost.replace(`.${baseDomain}`, '');
  }

  const parts = cleanHost.split('.');
  if (parts.length >= 3) {
    const candidate = parts[0];
    return candidate ? candidate : null;
  }

  return null;
};

export const attachRestaurant = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const headerSubdomain = req.get('x-restaurant-subdomain') || req.headers['x-restaurant-subdomain'];
    const host = req.get('host');
    let subdomain: string | null = null;

    if (typeof headerSubdomain === 'string' && headerSubdomain.trim()) {
      subdomain = headerSubdomain.trim().toLowerCase();
    } else if (!isLocalHost(host)) {
      subdomain = extractSubdomain(host);
    }

    if (!subdomain) {
      return next();
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { subdomain },
      select: {
        id: true,
        slug: true,
        subdomain: true,
        name: true,
        active: true,
        paymentCollectionTiming: true,
        cashPaymentEnabled: true,
      },
    });

    if (!restaurant || !restaurant.active) {
      return next(new AppError('Restaurant not found or inactive', 404));
    }

    req.restaurant = {
      id: restaurant.id,
      slug: restaurant.slug,
      subdomain: restaurant.subdomain,
      name: restaurant.name,
      paymentCollectionTiming: restaurant.paymentCollectionTiming,
      cashPaymentEnabled: restaurant.cashPaymentEnabled,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireRestaurant = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  if (!req.restaurant) {
    return next(new AppError('Restaurant context required', 400));
  }
  return next();
};

export const authorizeRestaurantRole = (...roles: Array<'OWNER' | 'ADMIN' | 'STAFF'>) => {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Access denied. Authentication required.', 401));
    }
    if (!req.restaurant) {
      return next(new AppError('Restaurant context required', 400));
    }

    const membership = await prisma.restaurantUser.findUnique({
      where: {
        restaurantId_userId: {
          restaurantId: req.restaurant.id,
          userId: req.user.id,
        },
      },
      select: {
        role: true,
        active: true,
      },
    });

    if (!membership || !membership.active) {
      return next(new AppError('Access denied. Restaurant membership required.', 403));
    }

    if (!roles.includes(membership.role as any)) {
      return next(new AppError('Access denied. Insufficient restaurant permissions.', 403));
    }

    return next();
  };
};
