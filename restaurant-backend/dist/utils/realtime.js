"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRestaurantEvent = exports.emitRestaurantEvent = exports.setSocketServer = void 0;
const events_1 = require("events");
const emitter = new events_1.EventEmitter();
emitter.setMaxListeners(0);
let socketServer = null;
const setSocketServer = (io) => {
    socketServer = io;
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
        ...event,
    };
    emitter.emit(restaurantId, nextEvent);
    emitSocketEvent(nextEvent);
};
exports.emitRestaurantEvent = emitRestaurantEvent;
const onRestaurantEvent = (restaurantId, listener) => {
    emitter.on(restaurantId, listener);
    return () => emitter.off(restaurantId, listener);
};
exports.onRestaurantEvent = onRestaurantEvent;
//# sourceMappingURL=realtime.js.map