"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const restaurant_1 = require("../middleware/restaurant");
const router = (0, express_1.Router)();
const menuItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(120),
    description: zod_1.z.string().max(600).optional(),
    pricePaise: zod_1.z.number().int().positive(),
    image: zod_1.z.string().url().optional(),
    categoryId: zod_1.z.string().min(1),
    available: zod_1.z.boolean().optional(),
    preparationTime: zod_1.z.number().int().min(1).max(300).optional(),
    ingredients: zod_1.z.array(zod_1.z.string()).optional(),
    allergens: zod_1.z.array(zod_1.z.string()).optional(),
    isVeg: zod_1.z.boolean().optional(),
    isVegan: zod_1.z.boolean().optional(),
    isGlutenFree: zod_1.z.boolean().optional(),
    spiceLevel: zod_1.z.enum(['NONE', 'MILD', 'MEDIUM', 'HOT', 'EXTRA_HOT']).optional(),
});
const menuItemUpdateSchema = menuItemSchema.partial();
router.get('/', restaurant_1.requireRestaurant, async (req, res) => {
    try {
        const { categoryId } = req.query;
        const menuItems = await database_1.prisma.menuItem.findMany({
            where: {
                available: true,
                restaurantId: req.restaurant.id,
                ...(categoryId && { categoryId: categoryId })
            },
            include: {
                category: true
            },
            orderBy: {
                name: 'asc'
            }
        });
        return res.json({
            success: true,
            data: menuItems,
            message: 'Menu items retrieved successfully'
        });
    }
    catch (error) {
        console.error('Error fetching menu items:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch menu items',
            message: 'An error occurred while retrieving menu items'
        });
    }
});
router.get('/admin/all', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const menuItems = await database_1.prisma.menuItem.findMany({
            where: {
                restaurantId: req.restaurant.id,
            },
            include: {
                category: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return res.json({
            success: true,
            data: menuItems,
            message: 'Admin menu items retrieved successfully',
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch admin menu items',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/:id', restaurant_1.requireRestaurant, async (req, res) => {
    try {
        const id = req.params['id'];
        const menuItem = await database_1.prisma.menuItem.findFirst({
            where: {
                id,
                restaurantId: req.restaurant.id,
            },
            include: {
                category: true
            }
        });
        if (!menuItem) {
            return res.status(404).json({
                success: false,
                error: 'Menu item not found',
                message: 'The requested menu item could not be found'
            });
        }
        if (!menuItem.available) {
            return res.status(404).json({
                success: false,
                error: 'Menu item not available',
                message: 'This menu item is currently not available'
            });
        }
        return res.json({
            success: true,
            data: menuItem,
            message: 'Menu item retrieved successfully'
        });
    }
    catch (error) {
        console.error('Error fetching menu item:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch menu item',
            message: 'An error occurred while retrieving the menu item'
        });
    }
});
router.post('/', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    try {
        const payload = menuItemSchema.parse(req.body);
        const category = await database_1.prisma.category.findFirst({
            where: {
                id: payload.categoryId,
                restaurantId: req.restaurant.id,
                active: true,
            },
            select: { id: true },
        });
        if (!category) {
            return res.status(400).json({
                success: false,
                error: 'Invalid category for this restaurant',
            });
        }
        const menuItem = await database_1.prisma.menuItem.create({
            data: {
                name: payload.name,
                description: payload.description ?? null,
                pricePaise: payload.pricePaise,
                image: payload.image ?? null,
                categoryId: payload.categoryId,
                available: payload.available ?? true,
                preparationTime: payload.preparationTime ?? 15,
                ingredients: payload.ingredients ?? [],
                allergens: payload.allergens ?? [],
                isVeg: payload.isVeg ?? true,
                isVegan: payload.isVegan ?? false,
                isGlutenFree: payload.isGlutenFree ?? false,
                spiceLevel: payload.spiceLevel ?? 'MILD',
                restaurantId: req.restaurant.id,
            },
            include: {
                category: true,
            },
        });
        return res.status(201).json({
            success: true,
            data: menuItem,
            message: 'Menu item created successfully',
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            error: 'Failed to create menu item',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.put('/:id', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    try {
        const id = req.params['id'];
        const payload = menuItemUpdateSchema.parse(req.body);
        const existing = await database_1.prisma.menuItem.findFirst({
            where: {
                id,
                restaurantId: req.restaurant.id,
            },
            select: { id: true },
        });
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: 'Menu item not found',
            });
        }
        if (payload.categoryId) {
            const category = await database_1.prisma.category.findFirst({
                where: {
                    id: payload.categoryId,
                    restaurantId: req.restaurant.id,
                    active: true,
                },
                select: { id: true },
            });
            if (!category) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid category for this restaurant',
                });
            }
        }
        const updateData = {};
        if (typeof payload.name !== 'undefined')
            updateData.name = payload.name;
        if (typeof payload.description !== 'undefined')
            updateData.description = payload.description ?? null;
        if (typeof payload.pricePaise !== 'undefined')
            updateData.pricePaise = payload.pricePaise;
        if (typeof payload.image !== 'undefined')
            updateData.image = payload.image ?? null;
        if (typeof payload.categoryId !== 'undefined')
            updateData.categoryId = payload.categoryId;
        if (typeof payload.available !== 'undefined')
            updateData.available = payload.available;
        if (typeof payload.preparationTime !== 'undefined')
            updateData.preparationTime = payload.preparationTime;
        if (typeof payload.ingredients !== 'undefined')
            updateData.ingredients = payload.ingredients;
        if (typeof payload.allergens !== 'undefined')
            updateData.allergens = payload.allergens;
        if (typeof payload.isVeg !== 'undefined')
            updateData.isVeg = payload.isVeg;
        if (typeof payload.isVegan !== 'undefined')
            updateData.isVegan = payload.isVegan;
        if (typeof payload.isGlutenFree !== 'undefined')
            updateData.isGlutenFree = payload.isGlutenFree;
        if (typeof payload.spiceLevel !== 'undefined')
            updateData.spiceLevel = payload.spiceLevel;
        const updated = await database_1.prisma.menuItem.update({
            where: { id },
            data: updateData,
            include: {
                category: true,
            },
        });
        return res.json({
            success: true,
            data: updated,
            message: 'Menu item updated successfully',
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            error: 'Failed to update menu item',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.patch('/:id/availability', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    try {
        const id = req.params['id'];
        const { available } = req.body;
        if (typeof available !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'available must be a boolean value',
            });
        }
        const existing = await database_1.prisma.menuItem.findFirst({
            where: {
                id,
                restaurantId: req.restaurant.id,
            },
            select: { id: true },
        });
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: 'Menu item not found',
            });
        }
        const updated = await database_1.prisma.menuItem.update({
            where: { id },
            data: { available },
            include: { category: true },
        });
        return res.json({
            success: true,
            data: updated,
            message: 'Menu item availability updated',
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to update menu item availability',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.delete('/:id', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    try {
        const id = req.params['id'];
        const existing = await database_1.prisma.menuItem.findFirst({
            where: {
                id,
                restaurantId: req.restaurant.id,
            },
            select: { id: true },
        });
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: 'Menu item not found',
            });
        }
        await database_1.prisma.menuItem.delete({
            where: { id },
        });
        return res.json({
            success: true,
            message: 'Menu item removed successfully',
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to delete menu item',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=menu.js.map