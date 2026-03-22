"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("@/config/database");
const restaurant_1 = require("@/middleware/restaurant");
const accelerate_cache_1 = require("@/utils/accelerate-cache");
const cache_1 = require("@/middleware/cache");
const router = (0, express_1.Router)();
router.get('/', restaurant_1.requireRestaurant, (0, cache_1.cacheResponse)(120, 'tables:list'), async (req, res) => {
    try {
        const take = typeof req.query.take !== 'undefined' ? Math.min(Number(req.query.take) || 0, 200) : undefined;
        const cursor = req.query.cursor ? { id: String(req.query.cursor) } : undefined;
        const tables = await database_1.prisma.table.findMany({
            where: { restaurantId: req.restaurant.id },
            ...(typeof take === 'number' ? { take } : {}),
            ...(cursor ? { cursor, skip: 1 } : {}),
            ...(0, accelerate_cache_1.accelerateCache)(60, 120),
        });
        return res.json({
            success: true,
            data: tables,
            message: 'Tables retrieved successfully'
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve tables',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/available', restaurant_1.requireRestaurant, (0, cache_1.cacheResponse)(60, 'tables:available'), async (req, res) => {
    try {
        const take = typeof req.query.take !== 'undefined' ? Math.min(Number(req.query.take) || 0, 200) : undefined;
        const cursor = req.query.cursor ? { id: String(req.query.cursor) } : undefined;
        const availableTables = await database_1.prisma.table.findMany({
            where: {
                active: true,
                restaurantId: req.restaurant.id,
            },
            ...(typeof take === 'number' ? { take } : {}),
            ...(cursor ? { cursor, skip: 1 } : {}),
            ...(0, accelerate_cache_1.accelerateCache)(60, 120),
        });
        return res.json({
            success: true,
            data: availableTables,
            message: 'Available tables retrieved successfully'
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve available tables',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:id', restaurant_1.requireRestaurant, (0, cache_1.cacheResponse)(120, 'tables:item'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Table ID is required',
                message: 'Please provide a valid table ID'
            });
        }
        const table = await database_1.prisma.table.findFirst({
            where: {
                id,
                restaurantId: req.restaurant.id,
            },
            ...(0, accelerate_cache_1.accelerateCache)(60, 120),
        });
        if (!table) {
            return res.status(404).json({
                success: false,
                error: 'Table not found',
                message: 'No table found with the provided ID'
            });
        }
        return res.json({
            success: true,
            data: table,
            message: 'Table retrieved successfully'
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve table',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=tables.js.map