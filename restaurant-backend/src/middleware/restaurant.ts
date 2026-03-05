import { Response, NextFunction, Request } from 'express';
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

const extractSlugFromPath = (req: Request): string | null => {
  const params = req.params as Record<string, string | undefined>;
  const paramSlug = params?.['restaurantSlug'] || params?.['slug'];
  if (paramSlug) return paramSlug.toLowerCase();

  const url = req.originalUrl || req.url || '';
  const match = /\/r\/([^\/?#]+)(\/|$)/i.exec(url);
  if (match && match[1]) return match[1].toLowerCase();

  return null;
};

export const attachRestaurant = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.restaurant) {
      return next();
    }
    const headerSlug = req.get('x-restaurant-slug') || req.headers['x-restaurant-slug'];
    const headerSubdomain = req.get('x-restaurant-subdomain') || req.headers['x-restaurant-subdomain'];
    const host = req.get('host');
    let restaurantIdentifier: string | null = null;

    const pathSlug = extractSlugFromPath(req);
    if (pathSlug) {
      restaurantIdentifier = pathSlug;
    } else if (typeof headerSlug === 'string' && headerSlug.trim()) {
      restaurantIdentifier = headerSlug.trim().toLowerCase();
    } else if (typeof headerSubdomain === 'string' && headerSubdomain.trim()) {
      restaurantIdentifier = headerSubdomain.trim().toLowerCase();
    } else if (!isLocalHost(host)) {
      restaurantIdentifier = extractSubdomain(host);
    }

    if (!restaurantIdentifier) {
      return next();
    }

    let restaurant: {
      id: string;
      slug: string;
      subdomain: string;
      name: string;
      active: boolean;
      paymentCollectionTiming: any;
      cashPaymentEnabled: boolean;
    } | null;
    try {
      restaurant = await prisma.restaurant.findFirst({
        where: {
          active: true,
          status: 'APPROVED',
          OR: [
            { id: restaurantIdentifier },
            { slug: restaurantIdentifier },
            { subdomain: restaurantIdentifier },
          ],
        },
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
    } catch (err: any) {
      // If the primary query fails due to schema mismatch, try a simplified query
      if (err.code === 'P2009' || (err.message && err.message.includes('does not exist'))) {
        console.warn('Database schema mismatch detected, trying alternative query:', err.message);
        try {
          // Try to query with just ID as a fallback
          const partialRestaurant = await prisma.restaurant.findFirst({
            where: {
              active: true,
              id: restaurantIdentifier,
            },
            select: {
              id: true,
              name: true,
              active: true,
              paymentCollectionTiming: true,
              cashPaymentEnabled: true,
            },
          });
          
          // If found, create a complete restaurant object with fallback values
          if (partialRestaurant) {
            restaurant = {
              ...partialRestaurant,
              slug: restaurantIdentifier,
              subdomain: restaurantIdentifier,
            };
          } else {
            restaurant = null;
          }
        } catch (fallbackErr: any) {
          console.warn('Fallback query also failed:', fallbackErr?.message || fallbackErr);
          restaurant = null;
        }
      } else {
        throw err; // Re-throw if it's a different error
      }
    }

    if (!restaurant) return next();

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
