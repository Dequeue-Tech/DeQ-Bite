"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const restaurant_1 = require("../middleware/restaurant");
const realtime_1 = require("../utils/realtime");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.get('/events', auth_1.authenticate, restaurant_1.requireRestaurant, (req, res) => {
    const requestedScope = typeof req.query['scope'] === 'string' ? req.query['scope'].trim().toLowerCase() : 'restaurant';
    const scope = requestedScope === 'user' || requestedScope === 'both' ? requestedScope : 'restaurant';
    const userId = req.user?.id;
    const restaurantId = req.restaurant.id;
    const eventsRaw = typeof req.query['events'] === 'string' ? req.query['events'] : '';
    const eventFilter = new Set(eventsRaw
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean));
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write('retry: 3000\n\n');
    const ping = () => {
        res.write(': ping\n\n');
        res.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    };
    const writeEvent = (event) => {
        if (eventFilter.size > 0 && !eventFilter.has(event.type)) {
            return;
        }
        if (scope === 'user' && event.userId !== userId)
            return;
        const idLine = event.eventId ? `id: ${event.eventId}\n` : '';
        res.write(`${idLine}event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        logger_1.logger.info('Realtime event delivered', {
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
    const replayEvents = (0, realtime_1.getBufferedEvents)({
        restaurantId,
        ...(scope !== 'restaurant' && userId ? { userId } : {}),
        ...(lastEventId ? { sinceEventId: lastEventId } : {}),
    });
    replayEvents.forEach((event) => {
        try {
            writeEvent(event);
        }
        catch {
        }
    });
    const offRestaurant = scope === 'user'
        ? () => { }
        : (0, realtime_1.onRestaurantEvent)(restaurantId, (event) => {
            try {
                writeEvent(event);
            }
            catch {
            }
        });
    const offUser = scope === 'restaurant' || !userId
        ? () => { }
        : (0, realtime_1.onUserEvent)(userId, (event) => {
            try {
                writeEvent(event);
            }
            catch {
            }
        });
    req.on('close', () => {
        clearInterval(keepAlive);
        offRestaurant();
        offUser();
        res.end();
    });
});
exports.default = router;
//# sourceMappingURL=realtime.js.map