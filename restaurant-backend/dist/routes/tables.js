"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    try {
        const tables = await database_1.prisma.table.findMany();
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
router.get('/available', async (_req, res) => {
    try {
        const availableTables = await database_1.prisma.table.findMany({
            where: {
                active: true
            }
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
router.get('/:id', async (_req, res) => {
    try {
        const { id } = _req.params;
        const table = await database_1.prisma.table.findUnique({
            where: {
                id: id
            }
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