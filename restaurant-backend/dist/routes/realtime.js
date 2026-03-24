"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const restaurant_1 = require("../middleware/restaurant");
const realtime_1 = require("../utils/realtime");
const router = (0, express_1.Router)();
router.get('/events', auth_1.authenticate, restaurant_1.requireRestaurant, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const ping = () => {
        res.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    };
    ping();
    const keepAlive = setInterval(ping, 25000);
    const off = (0, realtime_1.onRestaurantEvent)(req.restaurant.id, (event) => {
        try {
            res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        }
        catch {
        }
    });
    req.on('close', () => {
        clearInterval(keepAlive);
        off();
        res.end();
    });
});
exports.default = router;
//# sourceMappingURL=realtime.js.map