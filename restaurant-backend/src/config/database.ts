import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { logger } from '@/utils/logger';
import { getTenantContext } from '@/context/tenant-context';

const createPrismaClient = () => {
  const shouldLogQueries = process.env['LOG_SLOW_QUERIES'] !== 'false';
  const slowQueryMs = Number(process.env['SLOW_QUERY_MS'] || 200);
  const log: any[] = process.env.NODE_ENV === 'production'
    ? ['error', 'warn']
    : ['query', 'info', 'warn', 'error'];

  if (shouldLogQueries) {
    log.push({ emit: 'event', level: 'query' });
  }

  let client: any = new PrismaClient({ log });

  if (shouldLogQueries && typeof client.$on === 'function') {
    client.$on('query', (e: any) => {
      if (e.duration >= slowQueryMs) {
        const includeParams = process.env['LOG_SLOW_QUERY_PARAMS'] === 'true';
        logger.warn('Slow query detected', {
          durationMs: e.duration,
          query: e.query,
          ...(includeParams ? { params: e.params } : {}),
          target: e.target,
        });
      }
    });
  }

  // Prisma Accelerate/Data Proxy support (prisma+postgres:// or prisma+mysql://)
  const databaseUrl = process.env.DATABASE_URL || '';
  if (databaseUrl.startsWith('prisma+')) {
    client = client.$extends(withAccelerate());
  }

  return client;
};

const tenantScopedModels = new Set<string>([
  'RestaurantUser',
  'Category',
  'MenuItem',
  'PopularDish',
  'Table',
  'Order',
  'Coupon',
  'Offer',
  'Payment',
  'Earning',
  'AuditLog',
  'RawMaterial',
  'MenuItemRecipe',
  'InventoryTransaction',
  'InventoryAlert',
  'PurchaseOrder',
  'CustomerProfile',
  'LoyaltyLedger',
  'CouponRedemption',
  'KOTTicket',
  'KOTTicketEvent',
  'AnalyticsSnapshot',
  'PosSyncLog',
]);

const shouldScopeModel = (model?: string | null) => !!model && tenantScopedModels.has(model);
const modelToDelegate = (model: string) => `${model[0]?.toLowerCase() || ''}${model.slice(1)}`;

const mergeRestaurantWhere = (where: any, restaurantId: string) => {
  if (!where) return { restaurantId };
  if (typeof where !== 'object') return { AND: [where, { restaurantId }] };

  if (Object.prototype.hasOwnProperty.call(where, 'restaurantId')) {
    const existing = where.restaurantId;
    if (typeof existing === 'string' && existing !== restaurantId) {
      throw new Error('Cross-tenant access denied: restaurant mismatch');
    }
    return where;
  }

  if (Array.isArray(where.AND)) {
    return { ...where, AND: [...where.AND, { restaurantId }] };
  }

  return {
    AND: [where, { restaurantId }],
  };
};

const enforceCreateRestaurantId = (data: any, restaurantId: string) => {
  if (!data || typeof data !== 'object') return data;
  const next = { ...data };
  if (typeof next.restaurantId === 'string' && next.restaurantId !== restaurantId) {
    throw new Error('Cross-tenant write denied: restaurant mismatch');
  }
  next.restaurantId = restaurantId;
  return next;
};

const createTenantIsolatedClient = (base: ReturnType<typeof createPrismaClient>) => {
  return base.$extends({
    query: {
      async $allOperations({ model, operation, args, query }: any) {
        if (!shouldScopeModel(model)) {
          return query(args);
        }

        const { restaurantId, bypassIsolation } = getTenantContext();
        if (bypassIsolation) {
          return query(args);
        }

        if (!restaurantId) {
          throw new Error(`Tenant isolation violation: missing restaurant context for model ${model}`);
        }

        const nextArgs: any = args ? { ...args } : {};

        if (
          operation === 'findMany' ||
          operation === 'findFirst' ||
          operation === 'findFirstOrThrow' ||
          operation === 'count' ||
          operation === 'aggregate' ||
          operation === 'groupBy' ||
          operation === 'updateMany' ||
          operation === 'deleteMany'
        ) {
          nextArgs.where = mergeRestaurantWhere(nextArgs.where, restaurantId);
          return query(nextArgs);
        }

        if (operation === 'create') {
          nextArgs.data = enforceCreateRestaurantId(nextArgs.data, restaurantId);
          return query(nextArgs);
        }

        if (operation === 'createMany') {
          if (Array.isArray(nextArgs.data)) {
            nextArgs.data = nextArgs.data.map((item: any) => enforceCreateRestaurantId(item, restaurantId));
          } else {
            nextArgs.data = enforceCreateRestaurantId(nextArgs.data, restaurantId);
          }
          return query(nextArgs);
        }

        if (operation === 'upsert') {
          nextArgs.create = enforceCreateRestaurantId(nextArgs.create, restaurantId);
          if (nextArgs.update) {
            nextArgs.update = enforceCreateRestaurantId(nextArgs.update, restaurantId);
          }
          return query(nextArgs);
        }

        if (
          operation === 'findUnique' ||
          operation === 'findUniqueOrThrow' ||
          operation === 'update' ||
          operation === 'updateOrThrow' ||
          operation === 'delete' ||
          operation === 'deleteOrThrow'
        ) {
          const delegate = modelToDelegate(model);
          const guardRecord = await (base as any)[delegate]?.findFirst({
            where: mergeRestaurantWhere(nextArgs.where, restaurantId),
            select: { id: true },
          });

          if (!guardRecord) {
            if (operation === 'findUnique') {
              return null;
            }
            throw new Error(`Cross-tenant access denied or record not found for ${model}`);
          }

          if (operation === 'update' || operation === 'updateOrThrow') {
            nextArgs.data = enforceCreateRestaurantId(nextArgs.data, restaurantId);
          }

          return query(nextArgs);
        }

        return query(nextArgs);
      },
    },
  });
};

let prisma: ReturnType<typeof createPrismaClient>;

declare global {
  var __prisma: ReturnType<typeof createPrismaClient> | undefined;
}

if (process.env.NODE_ENV === 'production') {
  const baseClient = createPrismaClient();
  prisma = createTenantIsolatedClient(baseClient) as ReturnType<typeof createPrismaClient>;
} else {
  if (!global.__prisma) {
    const baseClient = createPrismaClient();
    global.__prisma = createTenantIsolatedClient(baseClient) as ReturnType<typeof createPrismaClient>;
  }
  prisma = global.__prisma;
}

export const connectDatabase = async () => {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};

export const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
    logger.info('✅ Database disconnected successfully');
  } catch (error) {
    logger.error('❌ Database disconnection failed:', error);
    throw error;
  }
};

export { prisma };

