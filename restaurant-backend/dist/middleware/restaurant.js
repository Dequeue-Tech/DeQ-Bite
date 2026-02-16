"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRestaurantRole = exports.requireRestaurant = exports.attachRestaurant = void 0;
const database_1 = require("@/config/database");
const errorHandler_1 = require("@/middleware/errorHandler");
const isLocalHost = (host) => {
    if (!host)
        return false;
    return host.startsWith('localhost') || host.startsWith('127.0.0.1');
};
const extractSubdomain = (host) => {
    if (!host)
        return null;
    const cleanHost = host.split(':')[0].toLowerCase();
    const baseDomain = (process.env['BASE_DOMAIN'] || '').toLowerCase();
    if (baseDomain && cleanHost.endsWith(`.${baseDomain}`)) {
        return cleanHost.replace(`.${baseDomain}`, '');
    }
    const parts = cleanHost.split('.');
    if (parts.length >= 3) {
        return parts[0] ?? null;
    }
    return null;
};
const attachRestaurant = async (req, _res, next) => {
    try {
        const headerSubdomain = req.get('x-restaurant-subdomain') || req.headers['x-restaurant-subdomain'];
        const host = req.get('host');
        let subdomain = null;
        if (typeof headerSubdomain === 'string' && headerSubdomain.trim()) {
            subdomain = headerSubdomain.trim().toLowerCase();
        }
        else if (!isLocalHost(host)) {
            subdomain = extractSubdomain(host);
        }
        if (!subdomain) {
            return next();
        }
        const restaurant = await database_1.prisma.restaurant.findUnique({
            where: { subdomain },
            select: {
                id: true,
                slug: true,
                subdomain: true,
                name: true,
                active: true,
            },
        });
        if (!restaurant || !restaurant.active) {
            return next(new errorHandler_1.AppError('Restaurant not found or inactive', 404));
        }
        req.restaurant = {
            id: restaurant.id,
            slug: restaurant.slug,
            subdomain: restaurant.subdomain,
            name: restaurant.name,
        };
        return next();
    }
    catch (error) {
        return next(error);
    }
};
exports.attachRestaurant = attachRestaurant;
const requireRestaurant = (req, _res, next) => {
    if (!req.restaurant) {
        return next(new errorHandler_1.AppError('Restaurant context required', 400));
    }
    return next();
};
exports.requireRestaurant = requireRestaurant;
const authorizeRestaurantRole = (...roles) => {
    return async (req, _res, next) => {
        if (!req.user) {
            return next(new errorHandler_1.AppError('Access denied. Authentication required.', 401));
        }
        if (!req.restaurant) {
            return next(new errorHandler_1.AppError('Restaurant context required', 400));
        }
        const membership = await database_1.prisma.restaurantUser.findUnique({
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
            return next(new errorHandler_1.AppError('Access denied. Restaurant membership required.', 403));
        }
        if (!roles.includes(membership.role)) {
            return next(new errorHandler_1.AppError('Access denied. Insufficient restaurant permissions.', 403));
        }
        return next();
    };
};
exports.authorizeRestaurantRole = authorizeRestaurantRole;
//# sourceMappingURL=restaurant.js.map