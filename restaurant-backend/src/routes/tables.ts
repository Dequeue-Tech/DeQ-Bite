import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../config/database'; // Use lazy initialization
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Get all tables
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
  const tables = await prisma.table.findMany();
  return res.json({
    success: true,
    data: tables,
    message: 'Tables retrieved successfully'
  });
}));

// Get available tables
router.get('/available', asyncHandler(async (_req: Request, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
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

// Get table by ID
router.get('/:id', asyncHandler(async (_req: Request, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
  const { id } = _req.params;
  
  // Check if id is provided
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

export default router;