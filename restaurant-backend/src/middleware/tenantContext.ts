import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '@/types/api';
import { runWithTenantContext } from '@/context/tenant-context';

const isPlatformRoute = (path: string) => path.startsWith('/api/platform');

export const attachTenantContext = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const isCentralAdmin = req.user?.role === 'CENTRAL_ADMIN';
  const bypassIsolation = isCentralAdmin || isPlatformRoute(req.originalUrl || req.url || '');
  const restaurantId = req.restaurant?.id || null;

  runWithTenantContext(
    {
      restaurantId,
      bypassIsolation,
    },
    () => next()
  );
};
