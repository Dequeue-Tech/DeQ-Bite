import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate } from '@/middleware/auth';
import { authorizeRestaurantRole, requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest } from '@/types/api';

const router = Router();

const menuItemSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(600).optional(),
  pricePaise: z.number().int().positive(),
  image: z.string().url().optional(),
  categoryId: z.string().min(1),
  available: z.boolean().optional(),
  preparationTime: z.number().int().min(1).max(300).optional(),
  ingredients: z.array(z.string()).optional(),
  allergens: z.array(z.string()).optional(),
  isVeg: z.boolean().optional(),
  isVegan: z.boolean().optional(),
  isGlutenFree: z.boolean().optional(),
  spiceLevel: z.enum(['NONE', 'MILD', 'MEDIUM', 'HOT', 'EXTRA_HOT']).optional(),
});

const menuItemUpdateSchema = menuItemSchema.partial();

// Get all menu items with optional category filter
router.get('/', requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { categoryId } = req.query;
    
    const menuItems = await prisma.menuItem.findMany({
      where: {
        available: true,
        restaurantId: req.restaurant!.id,
        ...(categoryId && { categoryId: categoryId as string })
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
  } catch (error) {
    console.error('Error fetching menu items:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch menu items',
      message: 'An error occurred while retrieving menu items'
    });
  }
});

// Get all menu items for admin/staff including unavailable items
router.get('/admin/all', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const menuItems = await prisma.menuItem.findMany({
      where: {
        restaurantId: req.restaurant!.id,
      },
      include: {
        category: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({
      success: true,
      data: menuItems,
      message: 'Admin menu items retrieved successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch admin menu items',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get a specific menu item by ID
router.get('/:id', requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params['id'] as string;
    
    const menuItem = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId: req.restaurant!.id,
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
  } catch (error) {
    console.error('Error fetching menu item:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch menu item',
      message: 'An error occurred while retrieving the menu item'
    });
  }
});

// Create a menu item
router.post('/', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const payload = menuItemSchema.parse(req.body);

    const category = await prisma.category.findFirst({
      where: {
        id: payload.categoryId,
        restaurantId: req.restaurant!.id,
        active: true,
      },
      select: { id: true },
    });

    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category for this restaurant',
      });
    }

    const menuItem = await prisma.menuItem.create({
      data: {
        name: payload.name,
        description: payload.description ?? null,
        pricePaise: payload.pricePaise,
        image: payload.image ?? null,
        categoryId: payload.categoryId,
        available: payload.available ?? true,
        preparationTime: payload.preparationTime ?? 15,
        ingredients: payload.ingredients ?? [],
        allergens: payload.allergens ?? [],
        isVeg: payload.isVeg ?? true,
        isVegan: payload.isVegan ?? false,
        isGlutenFree: payload.isGlutenFree ?? false,
        spiceLevel: payload.spiceLevel ?? 'MILD',
        restaurantId: req.restaurant!.id,
      },
      include: {
        category: true,
      },
    });

    return res.status(201).json({
      success: true,
      data: menuItem,
      message: 'Menu item created successfully',
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'Failed to create menu item',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update a menu item
router.put('/:id', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params['id'] as string;
    const payload = menuItemUpdateSchema.parse(req.body);

    const existing = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId: req.restaurant!.id,
      },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found',
      });
    }

    if (payload.categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: payload.categoryId,
          restaurantId: req.restaurant!.id,
          active: true,
        },
        select: { id: true },
      });

      if (!category) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category for this restaurant',
        });
      }
    }

    const updateData: any = {};
    if (typeof payload.name !== 'undefined') updateData.name = payload.name;
    if (typeof payload.description !== 'undefined') updateData.description = payload.description ?? null;
    if (typeof payload.pricePaise !== 'undefined') updateData.pricePaise = payload.pricePaise;
    if (typeof payload.image !== 'undefined') updateData.image = payload.image ?? null;
    if (typeof payload.categoryId !== 'undefined') updateData.categoryId = payload.categoryId;
    if (typeof payload.available !== 'undefined') updateData.available = payload.available;
    if (typeof payload.preparationTime !== 'undefined') updateData.preparationTime = payload.preparationTime;
    if (typeof payload.ingredients !== 'undefined') updateData.ingredients = payload.ingredients;
    if (typeof payload.allergens !== 'undefined') updateData.allergens = payload.allergens;
    if (typeof payload.isVeg !== 'undefined') updateData.isVeg = payload.isVeg;
    if (typeof payload.isVegan !== 'undefined') updateData.isVegan = payload.isVegan;
    if (typeof payload.isGlutenFree !== 'undefined') updateData.isGlutenFree = payload.isGlutenFree;
    if (typeof payload.spiceLevel !== 'undefined') updateData.spiceLevel = payload.spiceLevel;

    const updated = await prisma.menuItem.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
      },
    });

    return res.json({
      success: true,
      data: updated,
      message: 'Menu item updated successfully',
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'Failed to update menu item',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Toggle menu item availability
router.patch('/:id/availability', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params['id'] as string;
    const { available } = req.body as { available?: boolean };

    if (typeof available !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'available must be a boolean value',
      });
    }

    const existing = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId: req.restaurant!.id,
      },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found',
      });
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data: { available },
      include: { category: true },
    });

    return res.json({
      success: true,
      data: updated,
      message: 'Menu item availability updated',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to update menu item availability',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete a menu item
router.delete('/:id', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params['id'] as string;

    const existing = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId: req.restaurant!.id,
      },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found',
      });
    }

    await prisma.menuItem.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: 'Menu item removed successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to delete menu item',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
