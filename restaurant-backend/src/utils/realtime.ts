import { EventEmitter } from 'events';
import type { Server as SocketIOServer } from 'socket.io';

export type RealtimeEvent = {
  type: string;
  restaurantId: string;
  userId?: string;
  payload: any;
};

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

let socketServer: SocketIOServer | null = null;

export const setSocketServer = (io: SocketIOServer) => {
  socketServer = io;
};

const emitSocketEvent = (event: RealtimeEvent) => {
  if (!socketServer) return;
  socketServer.to(`restaurant:${event.restaurantId}`).emit(event.type, event);
  if (event.userId) {
    socketServer.to(`user:${event.userId}`).emit(event.type, event);
  }
};

export const emitRestaurantEvent = (restaurantId: string, event: Omit<RealtimeEvent, 'restaurantId'>) => {
  const nextEvent = {
    restaurantId,
    ...event,
  } as RealtimeEvent;

  emitter.emit(restaurantId, nextEvent);
  emitSocketEvent(nextEvent);
};

export const onRestaurantEvent = (restaurantId: string, listener: (event: RealtimeEvent) => void) => {
  emitter.on(restaurantId, listener);
  return () => emitter.off(restaurantId, listener);
};
