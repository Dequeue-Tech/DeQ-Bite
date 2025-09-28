"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
router.get('/', (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const prisma = (0, database_1.getPrismaClient)();
    const categories = await prisma.category.findMany({
        where: {
            active: true
        },
        orderBy: {
            sortOrder: 'asc'
        }
    });
    return res.json({
        success: true,
        data: categories,
        message: 'Categories retrieved successfully'
    });
}));
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const prisma = (0, database_1.getPrismaClient)();
    const { id } = _req.params;
    if (!id) {
        return res.status(400).json({
            success: false,
            error: 'Missing ID',
            message: 'Category ID is required'
        });
    }
    const category = await prisma.category.findUnique({
        where: {
            id: id
        }
    });
    if (!category) {
        return res.status(404).json({
            success: false,
            error: 'Category not found',
            message: 'The requested category could not be found'
        });
    }
    if (!category.active) {
        return res.status(404).json({
            success: false,
            error: 'Category not active',
            message: 'This category is currently not active'
        });
    }
    return res.json({
        success: true,
        data: category,
        message: 'Category retrieved successfully'
    });
}));
exports.default = router;
//# sourceMappingURL=categories.js.map