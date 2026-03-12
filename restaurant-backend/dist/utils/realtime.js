"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRestaurantEvent = exports.emitRestaurantEvent = void 0;
const events_1 = require("events");
const emitter = new events_1.EventEmitter();
emitter.setMaxListeners(0);
const emitRestaurantEvent = (restaurantId, event) => {
    emitter.emit(restaurantId, {
        restaurantId,
        ...event,
    });
};
exports.emitRestaurantEvent = emitRestaurantEvent;
const onRestaurantEvent = (restaurantId, listener) => {
    emitter.on(restaurantId, listener);
    return () => emitter.off(restaurantId, listener);
};
exports.onRestaurantEvent = onRestaurantEvent;
//# sourceMappingURL=realtime.js.map