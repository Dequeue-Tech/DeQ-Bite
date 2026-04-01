"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBufferedEvents = exports.onUserEvent = exports.onRestaurantEvent = exports.emitRoleScopedRestaurantEvent = exports.emitRestaurantEvent = void 0;
const events_1 = require("events");
const redis_1 = require("./redis");
const logger_1 = require("./logger");
const emitter = new events_1.EventEmitter();
emitter.setMaxListeners(0);
let redisBridgeInitialized = false;
const instanceId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const redisBroadcastChannel = 'realtime:broadcast';
const channelBuffers = new Map();
const MAX_BUFFERED_EVENTS_PER_CHANNEL = 250;
const EVENT_BUFFER_TTL_MS = 5 * 60 * 1000;
const isEventRecent = (event) => {
    if (!event.eventId)
        return false;
    const timestamp = Number(event.eventId.split('-')[0]);
    if (!Number.isFinite(timestamp))
        return false;
    return Date.now() - timestamp <= EVENT_BUFFER_TTL_MS;
};
const bufferEventForChannel = (channel, event) => {
    const current = channelBuffers.get(channel) || [];
    const trimmed = current.filter(isEventRecent);
    trimmed.push(event);
    if (trimmed.length > MAX_BUFFERED_EVENTS_PER_CHANNEL) {
        trimmed.splice(0, trimmed.length - MAX_BUFFERED_EVENTS_PER_CHANNEL);
    }
    channelBuffers.set(channel, trimmed);
};
const bufferEvent = (event) => {
    bufferEventForChannel(getRestaurantChannel(event.restaurantId), event);
    if (event.userId) {
        bufferEventForChannel(getUserChannel(event.userId), event);
    }
};
const publishLocalEvent = (event) => {
    bufferEvent(event);
    emitter.emit(getRestaurantChannel(event.restaurantId), event);
    if (event.userId) {
        emitter.emit(getUserChannel(event.userId), event);
    }
};
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
            publishLocalEvent(event);
        }
        catch (error) {
            logger_1.logger.warn('Invalid realtime redis payload', { message: error instanceof Error ? error.message : String(error) });
        }
    });
};
const getRestaurantChannel = (restaurantId) => `restaurant:${restaurantId}`;
const getUserChannel = (userId) => `user:${userId}`;
const emitRestaurantEvent = (restaurantId, event) => {
    initRedisRealtimeBridge();
    const nextEvent = {
        restaurantId,
        eventId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sourceInstanceId: instanceId,
        ...event,
    };
    publishLocalEvent(nextEvent);
    logger_1.logger.info('Realtime event emitted', {
        eventId: nextEvent.eventId,
        type: nextEvent.type,
        restaurantId: nextEvent.restaurantId,
        userId: nextEvent.userId,
    });
    const redis = (0, redis_1.getRedisClient)();
    if (redis) {
        redis.publish(redisBroadcastChannel, JSON.stringify(nextEvent)).catch(() => {
        });
    }
};
exports.emitRestaurantEvent = emitRestaurantEvent;
const emitRoleScopedRestaurantEvent = (restaurantId, event, roleScopes) => {
    (0, exports.emitRestaurantEvent)(restaurantId, {
        ...event,
        roleScopes,
    });
};
exports.emitRoleScopedRestaurantEvent = emitRoleScopedRestaurantEvent;
const onRestaurantEvent = (restaurantId, listener) => {
    initRedisRealtimeBridge();
    const channel = getRestaurantChannel(restaurantId);
    emitter.on(channel, listener);
    return () => emitter.off(channel, listener);
};
exports.onRestaurantEvent = onRestaurantEvent;
const onUserEvent = (userId, listener) => {
    initRedisRealtimeBridge();
    const channel = getUserChannel(userId);
    emitter.on(channel, listener);
    return () => emitter.off(channel, listener);
};
exports.onUserEvent = onUserEvent;
const getBufferedEvents = (input) => {
    const merged = [];
    const seenIds = new Set();
    const register = (event) => {
        if (!event.eventId)
            return;
        if (seenIds.has(event.eventId))
            return;
        seenIds.add(event.eventId);
        merged.push(event);
    };
    (channelBuffers.get(getRestaurantChannel(input.restaurantId)) || [])
        .filter(isEventRecent)
        .forEach(register);
    if (input.userId) {
        (channelBuffers.get(getUserChannel(input.userId)) || [])
            .filter(isEventRecent)
            .forEach(register);
    }
    const sorted = merged.sort((a, b) => {
        const at = Number(a.eventId?.split('-')[0] || 0);
        const bt = Number(b.eventId?.split('-')[0] || 0);
        return at - bt;
    });
    if (!input.sinceEventId)
        return sorted;
    const index = sorted.findIndex((event) => event.eventId === input.sinceEventId);
    if (index === -1)
        return sorted;
    return sorted.slice(index + 1);
};
exports.getBufferedEvents = getBufferedEvents;
//# sourceMappingURL=realtime.js.map