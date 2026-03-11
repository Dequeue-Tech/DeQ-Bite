import { EventEmitter } from 'events';

export type RealtimeEvent = {
  type: string;
  restaurantId: string;
  payload: any;
};

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export const emitRestaurantEvent = (restaurantId: string, event: Omit<RealtimeEvent, 'restaurantId'>) => {
  emitter.emit(restaurantId, {
    restaurantId,
    ...event,
  } as RealtimeEvent);
};

export const onRestaurantEvent = (restaurantId: string, listener: (event: RealtimeEvent) => void) => {
  emitter.on(restaurantId, listener);
  return () => emitter.off(restaurantId, listener);
};
