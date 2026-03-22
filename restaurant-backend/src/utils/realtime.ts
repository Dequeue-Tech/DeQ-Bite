import { EventEmitter } from 'events';
import type { Server as SocketIOServer } from 'socket.io';
import { getRedisClient } from '@/utils/redis';
import { logger } from '@/utils/logger';

export type RealtimeEvent = {
  eventId?: string;
  sourceInstanceId?: string;
  type: string;
  restaurantId: string;
  userId?: string;
  payload: any;
};

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

let socketServer: SocketIOServer | null = null;
let redisBridgeInitialized = false;
const instanceId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const redisBroadcastChannel = 'realtime:broadcast';

const initRedisRealtimeBridge = () => {
  if (redisBridgeInitialized) return;
  const redis = getRedisClient();
  if (!redis) return;

  redisBridgeInitialized = true;
  const subscriber = redis.duplicate();

  subscriber.subscribe(redisBroadcastChannel, (error) => {
    if (error) {
      logger.warn('Realtime redis subscribe failed', { message: error.message });
    }
  });

  subscriber.on('message', (_channel, rawPayload) => {
    try {
      const event = JSON.parse(rawPayload) as RealtimeEvent;
      if (event.sourceInstanceId === instanceId) {
        return;
      }

      emitter.emit(event.restaurantId, event);
      emitSocketEvent(event);
    } catch (error) {
      logger.warn('Invalid realtime redis payload', { message: error instanceof Error ? error.message : String(error) });
    }
  });
};

export const setSocketServer = (io: SocketIOServer) => {
  socketServer = io;
  initRedisRealtimeBridge();
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
    eventId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sourceInstanceId: instanceId,
    ...event,
  } as RealtimeEvent;

  emitter.emit(restaurantId, nextEvent);
  emitSocketEvent(nextEvent);

  const redis = getRedisClient();
  if (redis) {
    redis.publish(redisBroadcastChannel, JSON.stringify(nextEvent)).catch(() => {
      // ignore redis publish errors to keep request flow resilient
    });
  }
};

export const onRestaurantEvent = (restaurantId: string, listener: (event: RealtimeEvent) => void) => {
  emitter.on(restaurantId, listener);
  return () => emitter.off(restaurantId, listener);
};
