import { Router } from 'express';
import { prisma } from '@/config/database';
import { requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest } from '@/types/api';
import { accelerateCache } from '@/utils/accelerate-cache';

const router = Router();

// Get all tables
router.get('/', requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const take = typeof req.query.take !== 'undefined' ? Math.min(Number(req.query.take) || 0, 200) : undefined;
    const cursor = req.query.cursor ? { id: String(req.query.cursor) } : undefined;

    const tables = await prisma.table.findMany({
      where: { restaurantId: req.restaurant!.id },
      ...(typeof take === 'number' ? { take } : {}),
      ...(cursor ? { cursor, skip: 1 } : {}),
      ...(accelerateCache(60, 120) as any),
    });
    return res.json({
      success: true,
      data: tables,
      message: 'Tables retrieved successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve tables',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get available tables
router.get('/available', requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const take = typeof req.query.take !== 'undefined' ? Math.min(Number(req.query.take) || 0, 200) : undefined;
    const cursor = req.query.cursor ? { id: String(req.query.cursor) } : undefined;

    const availableTables = await prisma.table.findMany({
      where: {
        active: true,
        restaurantId: req.restaurant!.id,
      },
      ...(typeof take === 'number' ? { take } : {}),
      ...(cursor ? { cursor, skip: 1 } : {}),
      ...(accelerateCache(60, 120) as any),
    });
    return res.json({
      success: true,
      data: availableTables,
      message: 'Available tables retrieved successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve available tables',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get table by ID
router.get('/:id', requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Table ID is required',
        message: 'Please provide a valid table ID'
      });
    }
    const table = await prisma.table.findFirst({
      where: {
        id,
        restaurantId: req.restaurant!.id,
      },
      ...(accelerateCache(60, 120) as any),
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
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve table',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
