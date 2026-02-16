import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/types/api';
export declare const attachRestaurant: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => Promise<void>;
export declare const requireRestaurant: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => void;
export declare const authorizeRestaurantRole: (...roles: Array<"OWNER" | "ADMIN" | "STAFF">) => (req: AuthenticatedRequest, _res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=restaurant.d.ts.map