import { Router } from 'express';
import { prisma } from '@/config/database';

const router = Router();

// Get all tables
router.get('/', async (req, res) => {
  try {
    const tables = await prisma.table.findMany();
    res.json({
      success: true,
      data: tables,
      message: 'Tables retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tables',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get available tables
router.get('/available', async (req, res) => {
  try {
    const availableTables = await prisma.table.findMany({
      where: {
        active: true
      }
    });
    res.json({
      success: true,
      data: availableTables,
      message: 'Available tables retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve available tables',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get table by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
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
    
    res.json({
      success: true,
      data: table,
      message: 'Table retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve table',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;