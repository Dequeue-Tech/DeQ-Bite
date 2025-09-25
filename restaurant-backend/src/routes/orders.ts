import { Router } from 'express';
import { prisma } from '@/config/database';
import { authenticate } from '@/middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Create a new order
router.post('/', async (req, res) => {
  try {
    const { tableId, items, specialInstructions } = req.body;
    const userId = (req as any).user?.id;

    // Log the incoming request for debugging
    console.log('Order request received:', JSON.stringify(req.body, null, 2));
    console.log('TableId:', tableId);
    console.log('Items:', items);
    console.log('Special instructions:', specialInstructions);
    console.log('UserId:', userId);
    console.log('Request headers:', req.headers);
    
    // Validate required fields
    if (!tableId) {
      console.log('Validation failed: Missing tableId');
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tableId'
      });
    }

    if (!items) {
      console.log('Validation failed: Missing items');
      return res.status(400).json({
        success: false,
        error: 'Missing required field: items'
      });
    }

    if (!Array.isArray(items)) {
      console.log('Validation failed: Items is not an array');
      return res.status(400).json({
        success: false,
        error: 'Items must be an array'
      });
    }

    if (items.length === 0) {
      console.log('Validation failed: Items array is empty');
      return res.status(400).json({
        success: false,
        error: 'Items array cannot be empty'
      });
    }

    // Verify table exists and is active
    console.log('Looking up table with ID:', tableId);
    const table = await prisma.table.findUnique({
      where: { id: tableId }
    });
    console.log('Table lookup result:', table);

    if (!table) {
      console.log('Validation failed: Table not found');
      return res.status(400).json({
        success: false,
        error: 'Invalid table selected'
      });
    }

    if (!table.active) {
      console.log('Validation failed: Table is not active');
      return res.status(400).json({
        success: false,
        error: 'Selected table is not active'
      });
    }

    // Calculate totals
    let subtotal = 0;
    const orderItemsData = [];

    for (const [index, item] of items.entries()) {
      // Validate item structure
      if (!item) {
        console.log(`Validation failed: Item at index ${index} is null or undefined`);
        return res.status(400).json({
          success: false,
          error: `Item at position ${index + 1} is invalid`
        });
      }

      if (!item.menuItemId || !item.quantity) {
        console.log('Validation failed: Invalid item structure', item);
        return res.status(400).json({
          success: false,
          error: `Each item must have menuItemId and quantity. Item at position ${index + 1} is missing required fields.`
        });
      }

      // Validate quantity is a positive number
      if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        console.log('Validation failed: Invalid quantity', item);
        return res.status(400).json({
          success: false,
          error: `Quantity must be a positive integer. Item at position ${index + 1} has invalid quantity.`
        });
      }

      console.log(`Looking up menu item with ID: ${item.menuItemId}`);
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: item.menuItemId }
      });
      console.log(`Menu item lookup result for ${item.menuItemId}:`, menuItem);

      if (!menuItem) {
        console.log('Validation failed: Menu item not found', item.menuItemId);
        return res.status(400).json({
          success: false,
          error: `Menu item with id ${item.menuItemId} not found`
        });
      }

      if (!menuItem.available) {
        console.log('Validation failed: Menu item not available', item.menuItemId);
        return res.status(400).json({
          success: false,
          error: `Menu item "${menuItem.name}" is not available`
        });
      }

      const itemTotal = menuItem.price * item.quantity;
      subtotal += itemTotal;

      orderItemsData.push({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: menuItem.price,
        notes: item.notes || ''
      });
    }

    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + tax;

    // Create order in database
    const order = await prisma.order.create({
      data: {
        userId,
        tableId,
        subtotal,
        tax,
        total,
        specialInstructions: specialInstructions || '',
        items: {
          create: orderItemsData
        }
      },
      include: {
        items: {
          include: {
            menuItem: true
          }
        },
        table: true
      }
    });

    res.status(201).json({
      success: true,
      data: order,
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while creating order'
    });
  }
});

// Get all orders for authenticated user
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    
    const orders = await prisma.order.findMany({
      where: {
        userId
      },
      include: {
        items: {
          include: {
            menuItem: true
          }
        },
        table: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching orders'
    });
  }
});

// Get order by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const order = await prisma.order.findUnique({
      where: {
        id,
        userId
      },
      include: {
        items: {
          include: {
            menuItem: true
          }
        },
        table: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching order'
    });
  }
});

export default router;