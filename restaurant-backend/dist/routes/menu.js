"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    try {
        const { categoryId } = _req.query;
        const menuItems = await database_1.prisma.menuItem.findMany({
            where: {
                available: true,
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
router.get('/:id', async (_req, res) => {
    try {
        const { id } = _req.params;
        const menuItem = await database_1.prisma.menuItem.findUnique({
            where: {
                id
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
exports.default = router;
//# sourceMappingURL=menu.js.map