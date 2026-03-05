"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRestaurantRole = exports.requireRestaurant = exports.attachRestaurant = void 0;
const database_1 = require("../config/database");
const errorHandler_1 = require("./errorHandler");
const isLocalHost = (host) => {
    if (!host)
        return false;
    return host.startsWith('localhost') || host.startsWith('127.0.0.1');
};
const extractSubdomain = (host) => {
    if (!host)
        return null;
    const cleanHost = (host.split(':')[0] ?? '').toLowerCase();
    if (!cleanHost)
        return null;
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
const extractSlugFromPath = (req) => {
    const params = req.params;
    const paramSlug = params?.['restaurantSlug'] || params?.['slug'];
    if (paramSlug)
        return paramSlug.toLowerCase();
    const url = req.originalUrl || req.url || '';
    const match = /\/r\/([^\/?#]+)(\/|$)/i.exec(url);
    if (match && match[1])
        return match[1].toLowerCase();
    return null;
};
const attachRestaurant = async (req, _res, next) => {
    try {
        if (req.restaurant) {
            return next();
        }
        const headerSlug = req.get('x-restaurant-slug') || req.headers['x-restaurant-slug'];
        const headerSubdomain = req.get('x-restaurant-subdomain') || req.headers['x-restaurant-subdomain'];
        const host = req.get('host');
        let restaurantIdentifier = null;
        const pathSlug = extractSlugFromPath(req);
        if (pathSlug) {
            restaurantIdentifier = pathSlug;
        }
        else if (typeof headerSlug === 'string' && headerSlug.trim()) {
            restaurantIdentifier = headerSlug.trim().toLowerCase();
        }
        else if (typeof headerSubdomain === 'string' && headerSubdomain.trim()) {
            restaurantIdentifier = headerSubdomain.trim().toLowerCase();
        }
        else if (!isLocalHost(host)) {
            restaurantIdentifier = extractSubdomain(host);
        }
        if (!restaurantIdentifier) {
            return next();
        }
        let restaurant;
        try {
            restaurant = await database_1.prisma.restaurant.findFirst({
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
        }
        catch (err) {
            if (err.code === 'P2009' || (err.message && err.message.includes('does not exist'))) {
                console.warn('Database schema mismatch detected, trying alternative query:', err.message);
                try {
                    const partialRestaurant = await database_1.prisma.restaurant.findFirst({
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
                    if (partialRestaurant) {
                        restaurant = {
                            ...partialRestaurant,
                            slug: restaurantIdentifier,
                            subdomain: restaurantIdentifier,
                        };
                    }
                    else {
                        restaurant = null;
                    }
                }
                catch (fallbackErr) {
                    console.warn('Fallback query also failed:', fallbackErr?.message || fallbackErr);
                    restaurant = null;
                }
            }
            else {
                throw err;
            }
        }
        if (!restaurant)
            return next();
        req.restaurant = {
            id: restaurant.id,
            slug: restaurant.slug,
            subdomain: restaurant.subdomain,
            name: restaurant.name,
            paymentCollectionTiming: restaurant.paymentCollectionTiming,
            cashPaymentEnabled: restaurant.cashPaymentEnabled,
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