import { Router } from 'express';
import { prisma } from '@/config/database';

const router = Router();

// Get all categories
router.get('/', async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: {
        active: true
      },
      orderBy: {
        sortOrder: 'asc'
      }
    });

    return res.json({
      success: true,
      data: categories,
      message: 'Categories retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
      message: 'An error occurred while retrieving categories'
    });
  }
});

// Get a specific category by ID
router.get('/:id', async (_req, res) => {
  try {
    const { id } = _req.params;
    
    const category = await prisma.category.findUnique({
      where: {
        id
      }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
        message: 'The requested category could not be found'
      });
    }

    if (!category.active) {
      return res.status(404).json({
        success: false,
        error: 'Category not active',
        message: 'This category is currently not active'
      });
    }

    return res.json({
      success: true,
      data: category,
      message: 'Category retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch category',
      message: 'An error occurred while retrieving the category'
    });
  }
});

export default router;