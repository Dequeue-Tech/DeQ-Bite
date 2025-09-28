"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
router.get('/', (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const prisma = (0, database_1.getPrismaClient)();
    const tables = await prisma.table.findMany();
    return res.json({
        success: true,
        data: tables,
        message: 'Tables retrieved successfully'
    });
}));
router.get('/available', (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const prisma = (0, database_1.getPrismaClient)();
    const availableTables = await prisma.table.findMany({
        where: {
            active: true
        }
    });
    return res.json({
        success: true,
        data: availableTables,
        message: 'Available tables retrieved successfully'
    });
}));
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const prisma = (0, database_1.getPrismaClient)();
    const { id } = _req.params;
    if (!id) {
        return res.status(400).json({
            success: false,
            error: 'Missing ID',
            message: 'Table ID is required'
        });
    }
    const table = await prisma.table.findUnique({
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
}));
exports.default = router;
//# sourceMappingURL=tables.js.map