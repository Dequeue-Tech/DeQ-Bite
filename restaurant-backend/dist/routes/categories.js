"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("@/config/database");
const restaurant_1 = require("@/middleware/restaurant");
const router = (0, express_1.Router)();
router.get('/', restaurant_1.requireRestaurant, async (req, res) => {
    try {
        const categories = await database_1.prisma.category.findMany({
            where: {
                active: true,
                restaurantId: req.restaurant.id,
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
    }
    catch (error) {
        console.error('Error fetching categories:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch categories',
            message: 'An error occurred while retrieving categories'
        });
    }
});
router.get('/:id', restaurant_1.requireRestaurant, async (req, res) => {
    try {
        const { id } = req.params;
        const category = await database_1.prisma.category.findFirst({
            where: {
                id,
                restaurantId: req.restaurant.id,
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
    }
    catch (error) {
        console.error('Error fetching category:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch category',
            message: 'An error occurred while retrieving the category'
        });
    }
});
exports.default = router;
//# sourceMappingURL=categories.js.map