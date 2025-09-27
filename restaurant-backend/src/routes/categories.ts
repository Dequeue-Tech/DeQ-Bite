import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../config/database'; // Use lazy initialization
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Get all categories
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
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
}));

// Get a specific category by ID
router.get('/:id', asyncHandler(async (_req: Request, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
  const { id } = _req.params;
  
  // Check if id is provided
  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Missing ID',
      message: 'Category ID is required'
    });
  }
  
  const category = await prisma.category.findUnique({
    where: {
      id: id
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
}));

export default router;