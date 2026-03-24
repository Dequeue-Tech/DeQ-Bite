"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRestaurantEvent = exports.emitRestaurantEvent = exports.setSocketServer = void 0;
const events_1 = require("events");
const redis_1 = require("./redis");
const logger_1 = require("./logger");
const emitter = new events_1.EventEmitter();
emitter.setMaxListeners(0);
let socketServer = null;
let redisBridgeInitialized = false;
const instanceId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const redisBroadcastChannel = 'realtime:broadcast';
const initRedisRealtimeBridge = () => {
    if (redisBridgeInitialized)
        return;
    const redis = (0, redis_1.getRedisClient)();
    if (!redis)
        return;
    redisBridgeInitialized = true;
    const subscriber = redis.duplicate();
    subscriber.subscribe(redisBroadcastChannel, (error) => {
        if (error) {
            logger_1.logger.warn('Realtime redis subscribe failed', { message: error.message });
        }
    });
    subscriber.on('message', (_channel, rawPayload) => {
        try {
            const event = JSON.parse(rawPayload);
            if (event.sourceInstanceId === instanceId) {
                return;
            }
            emitter.emit(event.restaurantId, event);
            emitSocketEvent(event);
        }
        catch (error) {
            logger_1.logger.warn('Invalid realtime redis payload', { message: error instanceof Error ? error.message : String(error) });
        }
    });
};
const setSocketServer = (io) => {
    socketServer = io;
    initRedisRealtimeBridge();
};
exports.setSocketServer = setSocketServer;
const emitSocketEvent = (event) => {
    if (!socketServer)
        return;
    socketServer.to(`restaurant:${event.restaurantId}`).emit(event.type, event);
    if (event.userId) {
        socketServer.to(`user:${event.userId}`).emit(event.type, event);
    }
};
const emitRestaurantEvent = (restaurantId, event) => {
    const nextEvent = {
        restaurantId,
        eventId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sourceInstanceId: instanceId,
        ...event,
    };
    emitter.emit(restaurantId, nextEvent);
    emitSocketEvent(nextEvent);
    const redis = (0, redis_1.getRedisClient)();
    if (redis) {
        redis.publish(redisBroadcastChannel, JSON.stringify(nextEvent)).catch(() => {
        });
    }
};
exports.emitRestaurantEvent = emitRestaurantEvent;
const onRestaurantEvent = (restaurantId, listener) => {
    emitter.on(restaurantId, listener);
    return () => emitter.off(restaurantId, listener);
};
exports.onRestaurantEvent = onRestaurantEvent;
//# sourceMappingURL=realtime.js.map