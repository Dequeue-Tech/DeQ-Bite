import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { requireRestaurant } from '@/middleware/restaurant';
import { getBufferedEvents, onRestaurantEvent, onUserEvent } from '@/utils/realtime';
import { AuthenticatedRequest } from '@/types/api';
import { logger } from '@/utils/logger';

const router = Router();

// GET /api/:restaurantSlug/events
router.get('/events', authenticate, requireRestaurant, (req: AuthenticatedRequest, res) => {
  const requestedScope = typeof req.query['scope'] === 'string' ? req.query['scope'].trim().toLowerCase() : 'restaurant';
  const scope = requestedScope === 'user' || requestedScope === 'both' ? requestedScope : 'restaurant';
  const userId = req.user?.id;
  const restaurantId = req.restaurant!.id;
  const eventsRaw = typeof req.query['events'] === 'string' ? req.query['events'] : '';
  const eventFilter = new Set(
    eventsRaw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  (res as any).flushHeaders?.();
  res.write('retry: 3000\n\n');

  const ping = () => {
    res.write(': ping\n\n');
    res.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
  };

  const writeEvent = (event: { eventId?: string; type: string; userId?: string; [key: string]: any }) => {
    if (eventFilter.size > 0 && !eventFilter.has(event.type)) {
      return;
    }
    if (scope === 'user' && event.userId !== userId) return;

    const idLine = event.eventId ? `id: ${event.eventId}\n` : '';
    res.write(`${idLine}event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    logger.info('Realtime event delivered', {
      eventId: event.eventId,
      eventType: event.type,
      scope,
      restaurantId,
      userId,
    });
  };

  ping();
  const keepAlive = setInterval(ping, 25000);
  const lastEventIdHeader = req.get('Last-Event-ID') || req.get('last-event-id');
  const lastEventIdQuery = typeof req.query['lastEventId'] === 'string' ? req.query['lastEventId'] : undefined;
  const lastEventId = lastEventIdHeader || lastEventIdQuery;
  const replayEvents = getBufferedEvents({
    restaurantId,
    ...(scope !== 'restaurant' && userId ? { userId } : {}),
    ...(lastEventId ? { sinceEventId: lastEventId } : {}),
  });

  replayEvents.forEach((event) => {
    try {
      writeEvent(event);
    } catch {
      // ignore stream write errors during replay
    }
  });

  const offRestaurant =
    scope === 'user'
      ? () => {}
      : onRestaurantEvent(restaurantId, (event) => {
          try {
            writeEvent(event);
          } catch {
            // ignore stream write errors
          }
        });

  const offUser =
    scope === 'restaurant' || !userId
      ? () => {}
      : onUserEvent(userId, (event) => {
          try {
            writeEvent(event);
          } catch {
            // ignore stream write errors
          }
        });

  req.on('close', () => {
    clearInterval(keepAlive);
    offRestaurant();
    offUser();
    res.end();
  });
});

export default router;
