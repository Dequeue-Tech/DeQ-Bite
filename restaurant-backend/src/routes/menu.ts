import { Router } from 'express';
import { prisma } from '@/config/database';

const router = Router();

// Get all menu items with optional category filter
router.get('/', async (req, res) => {
  try {
    const { categoryId } = req.query;
    
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

    res.json({
      success: true,
      data: menuItems,
      message: 'Menu items retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu items',
      message: 'An error occurred while retrieving menu items'
    });
  }
});

// Get a specific menu item by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const menuItem = await prisma.menuItem.findUnique({
      where: {
        id
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

    res.json({
      success: true,
      data: menuItem,
      message: 'Menu item retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu item',
      message: 'An error occurred while retrieving the menu item'
    });
  }
});

export default router;