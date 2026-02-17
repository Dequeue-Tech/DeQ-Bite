import { Router } from 'express';
import { prisma } from '@/config/database';
import { requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest } from '@/types/api';

const router = Router();

// Get all tables
router.get('/', requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const tables = await prisma.table.findMany({
      where: { restaurantId: req.restaurant!.id },
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
    const availableTables = await prisma.table.findMany({
      where: {
        active: true,
        restaurantId: req.restaurant!.id,
      }
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
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve table',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
