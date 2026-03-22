import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { authenticate } from '@/middleware/auth';
import { authorizeRestaurantRole, requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest } from '@/types/api';
import { prisma } from '@/config/database';
import { receivePurchaseOrder, InventoryError } from '@/modules/inventory/inventory.service';

const router = Router();

const rawMaterialSchema = z.object({
  name: z.string().min(2).max(120),
  sku: z.string().max(60).optional(),
  unit: z.string().min(1).max(20),
  currentStock: z.number().nonnegative().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  costPerUnitPaise: z.number().int().nonnegative().optional(),
});

const recipeSchema = z.object({
  menuItemId: z.string().min(1),
  ingredients: z.array(
    z.object({
      rawMaterialId: z.string().min(1),
      quantity: z.number().positive(),
      wasteFactorPct: z.number().min(0).max(100).optional(),
    })
  ).min(1),
});

const createPurchaseOrderSchema = z.object({
  vendorName: z.string().min(2).max(160),
  notes: z.string().max(500).optional(),
  expectedDeliveryAt: z.coerce.date().optional(),
  items: z.array(z.object({
    rawMaterialId: z.string().min(1),
    quantityOrdered: z.number().positive(),
    unitCostPaise: z.number().int().nonnegative(),
  })).min(1),
});

const receiveSchema = z.object({
  items: z.array(z.object({
    rawMaterialId: z.string().min(1),
    quantityReceived: z.number().nonnegative(),
    unitCostPaise: z.number().int().nonnegative().optional(),
  })).min(1),
});

router.use(authenticate, requireRestaurant);

router.get('/raw-materials', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  const materials = await prisma.rawMaterial.findMany({
    where: { restaurantId: req.restaurant!.id },
    orderBy: { name: 'asc' },
  });

  return res.json({ success: true, data: materials });
});

router.post('/raw-materials', authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const payload = rawMaterialSchema.parse(req.body);
    const created = await prisma.rawMaterial.create({
      data: {
        restaurantId: req.restaurant!.id,
        name: payload.name,
        sku: payload.sku || null,
        unit: payload.unit,
        currentStock: payload.currentStock ?? 0,
        reorderLevel: payload.reorderLevel ?? 0,
        costPerUnitPaise: payload.costPerUnitPaise ?? 0,
      },
    });

    return res.status(201).json({ success: true, data: created, message: 'Raw material created' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
    }
    return res.status(500).json({ success: false, error: 'Failed to create raw material' });
  }
});

router.post('/recipes', authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const payload = recipeSchema.parse(req.body);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.menuItemRecipe.deleteMany({
        where: {
          restaurantId: req.restaurant!.id,
          menuItemId: payload.menuItemId,
        },
      });

      await tx.menuItemRecipe.createMany({
        data: payload.ingredients.map((ingredient) => ({
          restaurantId: req.restaurant!.id,
          menuItemId: payload.menuItemId,
          rawMaterialId: ingredient.rawMaterialId,
          quantity: ingredient.quantity,
          wasteFactorPct: ingredient.wasteFactorPct ?? 0,
        })),
      });
    });

    return res.json({ success: true, message: 'Recipe mapping saved successfully' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
    }
    return res.status(500).json({ success: false, error: 'Failed to save recipe mapping' });
  }
});

router.get('/recipes/menu/:menuItemId', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  const menuItemId = req.params['menuItemId'] as string;
  const recipes = await prisma.menuItemRecipe.findMany({
    where: {
      restaurantId: req.restaurant!.id,
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

router.get('/alerts', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  const onlyOpen = req.query['open'] !== 'false';
  const alerts = await prisma.inventoryAlert.findMany({
    where: {
      restaurantId: req.restaurant!.id,
      ...(onlyOpen ? { acknowledged: false } : {}),
    },
    include: {
      rawMaterial: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({ success: true, data: alerts });
});

router.patch('/alerts/:id/ack', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  const id = req.params['id'] as string;

  const updated = await prisma.inventoryAlert.update({
    where: { id },
    data: {
      acknowledged: true,
      acknowledgedAt: new Date(),
      acknowledgedByUserId: req.user?.id,
    },
  });

  return res.json({ success: true, data: updated, message: 'Alert acknowledged' });
});

router.get('/purchase-orders', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  const orders = await prisma.purchaseOrder.findMany({
    where: { restaurantId: req.restaurant!.id },
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

router.post('/purchase-orders', authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const payload = createPurchaseOrderSchema.parse(req.body);
    const totalCostPaise = payload.items.reduce((sum, item) => sum + Math.round(item.quantityOrdered * item.unitCostPaise), 0);

    const created = await prisma.purchaseOrder.create({
      data: {
        restaurantId: req.restaurant!.id,
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
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
    }

    return res.status(500).json({ success: false, error: 'Failed to create purchase order' });
  }
});

router.post('/purchase-orders/:id/receive', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const purchaseOrderId = req.params['id'] as string;
    const payload = receiveSchema.parse(req.body);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const receiveItems = payload.items.map((item) => ({
        rawMaterialId: item.rawMaterialId,
        quantityReceived: item.quantityReceived,
        unitCostPaise: item.unitCostPaise,
      }));
      await receivePurchaseOrder(tx, {
        restaurantId: req.restaurant!.id,
        purchaseOrderId,
        receivedByUserId: req.user?.id,
        items: receiveItems,
      });
    });

    return res.json({ success: true, message: 'Purchase order stock received and inventory updated' });
  } catch (error: unknown) {
    if (error instanceof InventoryError) {
      return res.status(error.statusCode).json({ success: false, error: error.message, details: error.details });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
    }

    return res.status(500).json({ success: false, error: 'Failed to receive purchase order' });
  }
});

export default router;
