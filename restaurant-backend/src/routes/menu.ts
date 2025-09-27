import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../config/database'; // Use lazy initialization
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Get all menu items with optional category filter
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
  const { categoryId } = _req.query;
  
  const menuItems = await prisma.menuItem.findMany({
    where: {
      available: true,
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
}));

// Get a specific menu item by ID
router.get('/:id', asyncHandler(async (_req: Request, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
  const { id } = _req.params;
  
  // Check if id is provided
  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Missing ID',
      message: 'Menu item ID is required'
    });
  }
  
  const menuItem = await prisma.menuItem.findUnique({
    where: {
      id: id
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
}));

export default router;