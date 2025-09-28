"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.post('/', (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const prisma = (0, database_1.getPrismaClient)();
    const { tableId, items, specialInstructions } = _req.body;
    const userId = _req.user?.id;
    console.log('Order request received:', JSON.stringify(_req.body, null, 2));
    console.log('TableId:', tableId);
    console.log('Items:', items);
    console.log('Special instructions:', specialInstructions);
    console.log('UserId:', userId);
    console.log('Request headers:', _req.headers);
    if (!tableId) {
        console.log('Validation failed: Missing tableId');
        return res.status(400).json({
            success: false,
            error: 'Missing required field: tableId'
        });
    }
    if (!items) {
        console.log('Validation failed: Missing items');
        return res.status(400).json({
            success: false,
            error: 'Missing required field: items'
        });
    }
    if (!Array.isArray(items)) {
        console.log('Validation failed: Items is not an array');
        return res.status(400).json({
            success: false,
            error: 'Items must be an array'
        });
    }
    if (items.length === 0) {
        console.log('Validation failed: Items array is empty');
        return res.status(400).json({
            success: false,
            error: 'Items array cannot be empty'
        });
    }
    console.log('Looking up table with ID:', tableId);
    const table = await prisma.table.findUnique({
        where: { id: tableId }
    });
    console.log('Table lookup result:', table);
    if (!table) {
        console.log('Validation failed: Table not found');
        return res.status(400).json({
            success: false,
            error: 'Invalid table selected'
        });
    }
    if (!table.active) {
        console.log('Validation failed: Table is not active');
        return res.status(400).json({
            success: false,
            error: 'Selected table is not active'
        });
    }
    let subtotal = 0;
    const orderItemsData = [];
    for (const [index, item] of items.entries()) {
        if (!item) {
            console.log(`Validation failed: Item at index ${index} is null or undefined`);
            return res.status(400).json({
                success: false,
                error: `Item at position ${index + 1} is invalid`
            });
        }
        if (!item.menuItemId || !item.quantity) {
            console.log('Validation failed: Invalid item structure', item);
            return res.status(400).json({
                success: false,
                error: `Each item must have menuItemId and quantity. Item at position ${index + 1} is missing required fields.`
            });
        }
        if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
            console.log('Validation failed: Invalid quantity', item);
            return res.status(400).json({
                success: false,
                error: `Quantity must be a positive integer. Item at position ${index + 1} has invalid quantity.`
            });
        }
        console.log(`Looking up menu item with ID: ${item.menuItemId}`);
        const menuItem = await prisma.menuItem.findUnique({
            where: { id: item.menuItemId }
        });
        console.log(`Menu item lookup result for ${item.menuItemId}:`, menuItem);
        if (!menuItem) {
            console.log('Validation failed: Menu item not found', item.menuItemId);
            return res.status(400).json({
                success: false,
                error: `Menu item with id ${item.menuItemId} not found`
            });
        }
        if (!menuItem.available) {
            console.log('Validation failed: Menu item not available', item.menuItemId);
            return res.status(400).json({
                success: false,
                error: `Menu item "${menuItem.name}" is not available`
            });
        }
        const itemTotal = menuItem.price * item.quantity;
        subtotal += itemTotal;
        orderItemsData.push({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: menuItem.price,
            notes: item.notes || ''
        });
    }
    const tax = subtotal * 0.08;
    const total = subtotal + tax;
    const order = await prisma.order.create({
        data: {
            userId,
            tableId,
            subtotal,
            tax,
            total,
            specialInstructions: specialInstructions || '',
            items: {
                create: orderItemsData
            }
        },
        include: {
            items: {
                include: {
                    menuItem: true
                }
            },
            table: true
        }
    });
    return res.status(201).json({
        success: true,
        data: order,
        message: 'Order created successfully'
    });
}));
router.get('/', (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const prisma = (0, database_1.getPrismaClient)();
    const userId = _req.user?.id;
    const orders = await prisma.order.findMany({
        where: {
            userId
        },
        include: {
            items: {
                include: {
                    menuItem: true
                }
            },
            table: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
    return res.json({
        success: true,
        data: orders
    });
}));
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const prisma = (0, database_1.getPrismaClient)();
    const { id } = _req.params;
    const userId = _req.user?.id;
    if (!id) {
        return res.status(400).json({
            success: false,
            error: 'Missing ID',
            message: 'Order ID is required'
        });
    }
    const order = await prisma.order.findUnique({
        where: {
            id: id,
            userId: userId
        },
        include: {
            items: {
                include: {
                    menuItem: true
                }
            },
            table: true
        }
    });
    if (!order) {
        return res.status(404).json({
            success: false,
            error: 'Order not found'
        });
    }
    return res.json({
        success: true,
        data: order
    });
}));
exports.default = router;
//# sourceMappingURL=orders.js.map