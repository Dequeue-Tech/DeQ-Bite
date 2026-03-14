import { Response, NextFunction, Request } from 'express';
import { prisma } from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/types/api';
import { Prisma } from '@prisma/client';
import { accelerateCache } from '@/utils/accelerate-cache';

// collect restaurant field names from generated client DMMF so we can safely
// build select clauses at runtime. This lets us deploy new code before the
// database/client are in sync without crashing due to missing fields.
const restaurantFields: string[] =
  ((prisma as any)._dmmf?.modelMap?.Restaurant?.fields || []).map((f: any) => f.name);

function pickFields(fields: string[]) {
  const out: any = {};
  if (restaurantFields.length === 0) {
    // _dmmf not exposed: fall back to explicit selects to avoid "select all"
    for (const f of fields) out[f] = true;
    return out;
  }
  for (const f of fields) {
    if (restaurantFields.includes(f)) out[f] = true;
  }
  return out;
}

/**
 * Build a select object from an array of field names; returns `undefined`
 * when no fields are available. Passing `undefined` to Prisma causes the
 * select clause to be omitted, which avoids the "select must not be empty"
 * validation error that we saw in production when the client schema was stale.
 */
function buildSelect(fields: string[]) {
  const sel = pickFields(fields);
  if (Object.keys(sel).length > 0) return sel;
  // Ensure we never send an empty select; fall back to id if available.
  if (restaurantFields.includes('id')) return { id: true };
  return undefined;
}

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
  const paramSlug = params?.['restaurantSlug'] || params?.['slug'] || params?.['restaurantId'];
  if (paramSlug) return paramSlug.toLowerCase();

  const url = req.originalUrl || req.url || '';

  // Match /api/restaurants/:id/... pattern (used by app.use() routes where params aren't populated yet)
  const restaurantsPathMatch = /\/api\/restaurants\/([^\/\?#]+)(\/|$)/i.exec(url);
  if (restaurantsPathMatch && restaurantsPathMatch[1]) {
    return restaurantsPathMatch[1].toLowerCase();
  }

  // Match /r/:slug/... pattern
  const match = /\/r\/([^/?#]+)(\/|$)/i.exec(url);
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

    // we use a relaxed `any` type here because the set of fields returned
    // may vary depending on which columns are present in the deployed schema.
    let restaurant: any | null;

    // figure out whether the generated client has the "status" field
    // PrismaClient does not expose `_dmmf` in the types, so cast to any to
    // detect whether the schema has a `status` field. This allows us to avoid
    // referencing it if the deployed client is out of date.
    const hasStatus =
      !!(prisma as any)._dmmf?.modelMap?.Restaurant?.fields?.some((f: any) => f.name === 'status');

    // build the primary filter once so we can modify if needed
    const baseFilter: Prisma.RestaurantWhereInput = {
      active: true,
      ...(hasStatus ? { status: 'APPROVED' } : {}),
      OR: [
        { id: restaurantIdentifier },
        { slug: restaurantIdentifier },
        { subdomain: restaurantIdentifier },
      ],
    };

    const basicSelect = buildSelect([
      'id',
      'slug',
      'subdomain',
      'name',
      'active',
      'paymentCollectionTiming',
      'cashPaymentEnabled',
    ]);
    try {
      restaurant = await prisma.restaurant.findFirst({
        where: baseFilter,
        ...(basicSelect ? { select: basicSelect } : {}),
        ...(accelerateCache(30, 60) as any),
      });
    } catch (err: any) {
      // If the client schema doesn't know about "status" or other fields, fall back
      const isSchemaMismatch =
        err.code === 'P2009' ||
        (err.message &&
          (err.message.includes('does not exist') || err.message.includes('Unknown argument `status`')));

      if (isSchemaMismatch) {
        console.warn('Database/client schema mismatch detected, trying alternative query:', err.message);
        try {
          // remove the status clause for the fallback query
          const fallbackFilter = { ...baseFilter };
          delete (fallbackFilter as any).status;

          const fallbackSelect = buildSelect([
            'id',
            'name',
            'active',
            'paymentCollectionTiming',
            'cashPaymentEnabled',
          ]);
          const partialRestaurant = await prisma.restaurant.findFirst({
            where: fallbackFilter,
            ...(fallbackSelect ? { select: fallbackSelect } : {}),
            ...(accelerateCache(30, 60) as any),
          });

          if (partialRestaurant) {
            restaurant = {
              ...partialRestaurant,
              slug: restaurantIdentifier!,
              subdomain: restaurantIdentifier!,
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
  if (req.user && ['OWNER', 'ADMIN', 'STAFF', 'KITCHEN_STAFF'].includes(req.user.role)) {
    prisma.restaurantUser
      .findUnique({
        where: {
          restaurantId_userId: {
            restaurantId: req.restaurant.id,
            userId: req.user.id,
          },
        },
        select: { active: true },
      })
      .then((membership) => {
        if (!membership || !membership.active) {
          return next(new AppError('Access denied. Restaurant membership required.', 403));
        }
        return next();
      })
      .catch((error) => next(error));
    return;
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
