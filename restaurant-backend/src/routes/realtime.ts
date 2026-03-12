import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { requireRestaurant } from '@/middleware/restaurant';
import { onRestaurantEvent } from '@/utils/realtime';
import { AuthenticatedRequest } from '@/types/api';

const router = Router();

// GET /api/:restaurantSlug/events
router.get('/events', authenticate, requireRestaurant, (req: AuthenticatedRequest, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  (res as any).flushHeaders?.();

  const ping = () => {
    res.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
  };

  ping();
  const keepAlive = setInterval(ping, 25000);

  const off = onRestaurantEvent(req.restaurant!.id, (event) => {
    try {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    } catch {
      // ignore stream write errors
    }
  });

  req.on('close', () => {
    clearInterval(keepAlive);
    off();
    res.end();
  });
});

export default router;
