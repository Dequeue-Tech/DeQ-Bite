"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("@/middleware/auth");
const restaurant_1 = require("@/middleware/restaurant");
const database_1 = require("@/config/database");
const inventory_service_1 = require("@/modules/inventory/inventory.service");
const router = (0, express_1.Router)();
const rawMaterialSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(120),
    sku: zod_1.z.string().max(60).optional(),
    unit: zod_1.z.string().min(1).max(20),
    currentStock: zod_1.z.number().nonnegative().optional(),
    reorderLevel: zod_1.z.number().nonnegative().optional(),
    costPerUnitPaise: zod_1.z.number().int().nonnegative().optional(),
});
const recipeSchema = zod_1.z.object({
    menuItemId: zod_1.z.string().min(1),
    ingredients: zod_1.z.array(zod_1.z.object({
        rawMaterialId: zod_1.z.string().min(1),
        quantity: zod_1.z.number().positive(),
        wasteFactorPct: zod_1.z.number().min(0).max(100).optional(),
    })).min(1),
});
const createPurchaseOrderSchema = zod_1.z.object({
    vendorName: zod_1.z.string().min(2).max(160),
    notes: zod_1.z.string().max(500).optional(),
    expectedDeliveryAt: zod_1.z.coerce.date().optional(),
    items: zod_1.z.array(zod_1.z.object({
        rawMaterialId: zod_1.z.string().min(1),
        quantityOrdered: zod_1.z.number().positive(),
        unitCostPaise: zod_1.z.number().int().nonnegative(),
    })).min(1),
});
const receiveSchema = zod_1.z.object({
    items: zod_1.z.array(zod_1.z.object({
        rawMaterialId: zod_1.z.string().min(1),
        quantityReceived: zod_1.z.number().nonnegative(),
        unitCostPaise: zod_1.z.number().int().nonnegative().optional(),
    })).min(1),
});
router.use(auth_1.authenticate, restaurant_1.requireRestaurant);
router.get('/raw-materials', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    const materials = await database_1.prisma.rawMaterial.findMany({
        where: { restaurantId: req.restaurant.id },
        orderBy: { name: 'asc' },
    });
    return res.json({ success: true, data: materials });
});
router.post('/raw-materials', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    try {
        const payload = rawMaterialSchema.parse(req.body);
        const created = await database_1.prisma.rawMaterial.create({
            data: {
                restaurantId: req.restaurant.id,
                name: payload.name,
                sku: payload.sku || null,
                unit: payload.unit,
                currentStock: payload.currentStock ?? 0,
                reorderLevel: payload.reorderLevel ?? 0,
                costPerUnitPaise: payload.costPerUnitPaise ?? 0,
            },
        });
        return res.status(201).json({ success: true, data: created, message: 'Raw material created' });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
        }
        return res.status(500).json({ success: false, error: 'Failed to create raw material' });
    }
});
router.post('/recipes', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    try {
        const payload = recipeSchema.parse(req.body);
        await database_1.prisma.$transaction(async (tx) => {
            await tx.menuItemRecipe.deleteMany({
                where: {
                    restaurantId: req.restaurant.id,
                    menuItemId: payload.menuItemId,
                },
            });
            await tx.menuItemRecipe.createMany({
                data: payload.ingredients.map((ingredient) => ({
                    restaurantId: req.restaurant.id,
                    menuItemId: payload.menuItemId,
                    rawMaterialId: ingredient.rawMaterialId,
                    quantity: ingredient.quantity,
                    wasteFactorPct: ingredient.wasteFactorPct ?? 0,
                })),
            });
        });
        return res.json({ success: true, message: 'Recipe mapping saved successfully' });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
        }
        return res.status(500).json({ success: false, error: 'Failed to save recipe mapping' });
    }
});
router.get('/recipes/menu/:menuItemId', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    const menuItemId = req.params['menuItemId'];
    const recipes = await database_1.prisma.menuItemRecipe.findMany({
        where: {
            restaurantId: req.restaurant.id,
            menuItemId,
        },
        include: {
            rawMaterial: true,
            menuItem: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });
    return res.json({ success: true, data: recipes });
});
router.get('/alerts', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    const onlyOpen = req.query['open'] !== 'false';
    const alerts = await database_1.prisma.inventoryAlert.findMany({
        where: {
            restaurantId: req.restaurant.id,
            ...(onlyOpen ? { acknowledged: false } : {}),
        },
        include: {
            rawMaterial: true,
        },
        orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: alerts });
});
router.patch('/alerts/:id/ack', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    const id = req.params['id'];
    const updated = await database_1.prisma.inventoryAlert.update({
        where: { id },
        data: {
            acknowledged: true,
            acknowledgedAt: new Date(),
            acknowledgedByUserId: req.user?.id,
        },
    });
    return res.json({ success: true, data: updated, message: 'Alert acknowledged' });
});
router.get('/purchase-orders', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    const orders = await database_1.prisma.purchaseOrder.findMany({
        where: { restaurantId: req.restaurant.id },
        include: {
            items: {
                include: {
                    rawMaterial: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: orders });
});
router.post('/purchase-orders', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    try {
        const payload = createPurchaseOrderSchema.parse(req.body);
        const totalCostPaise = payload.items.reduce((sum, item) => sum + Math.round(item.quantityOrdered * item.unitCostPaise), 0);
        const created = await database_1.prisma.purchaseOrder.create({
            data: {
                restaurantId: req.restaurant.id,
                vendorName: payload.vendorName,
                notes: payload.notes || null,
                expectedDeliveryAt: payload.expectedDeliveryAt,
                status: 'ORDERED',
                totalCostPaise,
                createdByUserId: req.user?.id,
                items: {
                    create: payload.items,
                },
            },
            include: {
                items: true,
            },
        });
        return res.status(201).json({ success: true, data: created, message: 'Purchase order created' });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
        }
        return res.status(500).json({ success: false, error: 'Failed to create purchase order' });
    }
});
router.post('/purchase-orders/:id/receive', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const purchaseOrderId = req.params['id'];
        const payload = receiveSchema.parse(req.body);
        await database_1.prisma.$transaction(async (tx) => {
            const receiveItems = payload.items.map((item) => ({
                rawMaterialId: item.rawMaterialId,
                quantityReceived: item.quantityReceived,
                unitCostPaise: item.unitCostPaise,
            }));
            await (0, inventory_service_1.receivePurchaseOrder)(tx, {
                restaurantId: req.restaurant.id,
                purchaseOrderId,
                receivedByUserId: req.user?.id,
                items: receiveItems,
            });
        });
        return res.json({ success: true, message: 'Purchase order stock received and inventory updated' });
    }
    catch (error) {
        if (error instanceof inventory_service_1.InventoryError) {
            return res.status(error.statusCode).json({ success: false, error: error.message, details: error.details });
        }
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
        }
        return res.status(500).json({ success: false, error: 'Failed to receive purchase order' });
    }
});
exports.default = router;
//# sourceMappingURL=inventory.routes.js.map