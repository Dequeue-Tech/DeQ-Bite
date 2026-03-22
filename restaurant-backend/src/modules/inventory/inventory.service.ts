import { Prisma, PrismaClient } from '@prisma/client';

export class InventoryError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'InventoryError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

type InventoryTx = Prisma.TransactionClient | PrismaClient;

type DeductionItem = {
  menuItemId: string;
  quantity: number;
};

type DeductionParams = {
  restaurantId: string;
  orderId: string;
  createdByUserId?: string | undefined;
  items: DeductionItem[];
};

const round = (value: number) => Math.round(value * 1000) / 1000;

export const deductInventoryForOrder = async (tx: InventoryTx, params: DeductionParams) => {
  const uniqueMenuItemIds = Array.from(new Set(params.items.map((item) => item.menuItemId)));

  if (uniqueMenuItemIds.length === 0) {
    return { adjustedMaterials: 0, lowStockAlerts: [] as string[] };
  }

  const recipes = await tx.menuItemRecipe.findMany({
    where: {
      restaurantId: params.restaurantId,
      menuItemId: { in: uniqueMenuItemIds },
    },
    include: {
      rawMaterial: {
        select: {
          id: true,
          name: true,
          currentStock: true,
          reorderLevel: true,
          unit: true,
          active: true,
        },
      },
    },
  });

  const recipesByMenuItem = new Map<string, typeof recipes>();
  for (const recipe of recipes) {
    const list = recipesByMenuItem.get(recipe.menuItemId) || [];
    list.push(recipe);
    recipesByMenuItem.set(recipe.menuItemId, list);
  }

  const requiredByMaterial = new Map<string, {
    name: string;
    unit: string;
    requiredQty: number;
    reorderLevel: number;
    currentStock: number;
  }>();

  for (const item of params.items) {
    const mappings = recipesByMenuItem.get(item.menuItemId) || [];
    for (const mapping of mappings) {
      if (!mapping.rawMaterial.active) {
        throw new InventoryError(`Raw material \"${mapping.rawMaterial.name}\" is inactive`, 400);
      }

      const requiredQty = mapping.quantity * item.quantity * (1 + mapping.wasteFactorPct / 100);
      const existing = requiredByMaterial.get(mapping.rawMaterialId);
      if (existing) {
        existing.requiredQty = round(existing.requiredQty + requiredQty);
      } else {
        requiredByMaterial.set(mapping.rawMaterialId, {
          name: mapping.rawMaterial.name,
          unit: mapping.rawMaterial.unit,
          requiredQty: round(requiredQty),
          reorderLevel: mapping.rawMaterial.reorderLevel,
          currentStock: mapping.rawMaterial.currentStock,
        });
      }
    }
  }

  const shortages: Array<{ rawMaterialId: string; name: string; required: number; available: number; unit: string }> = [];

  for (const [rawMaterialId, requirement] of requiredByMaterial.entries()) {
    if (requirement.currentStock < requirement.requiredQty) {
      shortages.push({
        rawMaterialId,
        name: requirement.name,
        required: requirement.requiredQty,
        available: requirement.currentStock,
        unit: requirement.unit,
      });
    }
  }

  if (shortages.length > 0) {
    throw new InventoryError('Insufficient inventory for one or more order items', 409, { shortages });
  }

  const lowStockAlerts: string[] = [];

  for (const [rawMaterialId, requirement] of requiredByMaterial.entries()) {
    const current = requirement.currentStock;
    const next = round(current - requirement.requiredQty);

    await tx.rawMaterial.update({
      where: { id: rawMaterialId },
      data: { currentStock: next },
    });

    await tx.inventoryTransaction.create({
      data: {
        restaurantId: params.restaurantId,
        rawMaterialId,
        orderId: params.orderId,
        type: 'DEDUCTION',
        referenceType: 'ORDER',
        referenceId: params.orderId,
        quantityDelta: -requirement.requiredQty,
        stockBefore: current,
        stockAfter: next,
        notes: 'Auto-deducted from recipe mapping on order placement',
        createdByUserId: params.createdByUserId ?? null,
      },
    });

    if (next <= requirement.reorderLevel) {
      lowStockAlerts.push(rawMaterialId);
      await tx.inventoryAlert.create({
        data: {
          restaurantId: params.restaurantId,
          rawMaterialId,
          type: 'LOW_STOCK',
          thresholdValue: requirement.reorderLevel,
          currentValue: next,
        },
      });
    }
  }

  return {
    adjustedMaterials: requiredByMaterial.size,
    lowStockAlerts,
  };
};

export const receivePurchaseOrder = async (
  tx: InventoryTx,
  params: {
    restaurantId: string;
    purchaseOrderId: string;
    receivedByUserId?: string | undefined;
    items: Array<{ rawMaterialId: string; quantityReceived: number; unitCostPaise?: number | undefined }>;
  }
) => {
  const purchaseOrder = await tx.purchaseOrder.findFirst({
    where: { id: params.purchaseOrderId, restaurantId: params.restaurantId },
    include: { items: true },
  });

  if (!purchaseOrder) {
    throw new InventoryError('Purchase order not found', 404);
  }

  const poItemsByMaterial = new Map(purchaseOrder.items.map((item) => [item.rawMaterialId, item]));
  let totalCostPaise = purchaseOrder.totalCostPaise;

  for (const received of params.items) {
    const poItem = poItemsByMaterial.get(received.rawMaterialId);
    if (!poItem) {
      throw new InventoryError(`Raw material ${received.rawMaterialId} is not part of this purchase order`, 400);
    }

    const rawMaterial = await tx.rawMaterial.findFirst({
      where: { id: received.rawMaterialId, restaurantId: params.restaurantId },
      select: { id: true, currentStock: true },
    });

    if (!rawMaterial) {
      throw new InventoryError('Raw material not found', 404);
    }

    const qty = Math.max(received.quantityReceived, 0);
    const nextStock = rawMaterial.currentStock + qty;
    const unitCost = typeof received.unitCostPaise === 'number' ? received.unitCostPaise : poItem.unitCostPaise;
    const lineCost = Math.round(unitCost * qty);
    totalCostPaise += lineCost;

    await tx.rawMaterial.update({
      where: { id: rawMaterial.id },
      data: { currentStock: nextStock },
    });

    await tx.purchaseOrderItem.update({
      where: { id: poItem.id },
      data: {
        quantityReceived: {
          increment: qty,
        },
      },
    });

    await tx.inventoryTransaction.create({
      data: {
        restaurantId: params.restaurantId,
        rawMaterialId: rawMaterial.id,
        type: 'RESTOCK',
        referenceType: 'PURCHASE',
        referenceId: params.purchaseOrderId,
        quantityDelta: qty,
        stockBefore: rawMaterial.currentStock,
        stockAfter: nextStock,
        unitCostPaise: unitCost,
        totalCostPaise: lineCost,
        notes: 'Stock received against purchase order',
        createdByUserId: params.receivedByUserId ?? null,
      },
    });
  }

  const updatedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: params.purchaseOrderId } });
  const allReceived = updatedItems.every((item) => item.quantityReceived >= item.quantityOrdered);
  const anyReceived = updatedItems.some((item) => item.quantityReceived > 0);

  await tx.purchaseOrder.update({
    where: { id: params.purchaseOrderId },
    data: {
      status: allReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : 'ORDERED',
      receivedAt: anyReceived ? new Date() : null,
      totalCostPaise,
    },
  });
};
