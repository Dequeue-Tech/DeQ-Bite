"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
router.get('/', (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const prisma = (0, database_1.getPrismaClient)();
    const { categoryId } = _req.query;
    const menuItems = await prisma.menuItem.findMany({
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
}));
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const prisma = (0, database_1.getPrismaClient)();
    const { id } = _req.params;
    if (!id) {
        return res.status(400).json({
            success: false,
            error: 'Missing ID',
            message: 'Menu item ID is required'
        });
    }
    const menuItem = await prisma.menuItem.findUnique({
        where: {
            id: id
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
}));
exports.default = router;
//# sourceMappingURL=menu.js.map