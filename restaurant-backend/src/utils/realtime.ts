import { EventEmitter } from 'events';
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

let redisBridgeInitialized = false;
const instanceId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const redisBroadcastChannel = 'realtime:broadcast';
const channelBuffers = new Map<string, RealtimeEvent[]>();
const MAX_BUFFERED_EVENTS_PER_CHANNEL = 250;
const EVENT_BUFFER_TTL_MS = 5 * 60 * 1000;

const isEventRecent = (event: RealtimeEvent) => {
  if (!event.eventId) return false;
  const timestamp = Number(event.eventId.split('-')[0]);
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= EVENT_BUFFER_TTL_MS;
};

const bufferEventForChannel = (channel: string, event: RealtimeEvent) => {
  const current = channelBuffers.get(channel) || [];
  const trimmed = current.filter(isEventRecent);
  trimmed.push(event);
  if (trimmed.length > MAX_BUFFERED_EVENTS_PER_CHANNEL) {
    trimmed.splice(0, trimmed.length - MAX_BUFFERED_EVENTS_PER_CHANNEL);
  }
  channelBuffers.set(channel, trimmed);
};

const bufferEvent = (event: RealtimeEvent) => {
  bufferEventForChannel(getRestaurantChannel(event.restaurantId), event);
  if (event.userId) {
    bufferEventForChannel(getUserChannel(event.userId), event);
  }
};

const publishLocalEvent = (event: RealtimeEvent) => {
  bufferEvent(event);
  emitter.emit(getRestaurantChannel(event.restaurantId), event);
  if (event.userId) {
    emitter.emit(getUserChannel(event.userId), event);
  }
};

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

      publishLocalEvent(event);
    } catch (error) {
      logger.warn('Invalid realtime redis payload', { message: error instanceof Error ? error.message : String(error) });
    }
  });
};

const getRestaurantChannel = (restaurantId: string) => `restaurant:${restaurantId}`;
const getUserChannel = (userId: string) => `user:${userId}`;

export const emitRestaurantEvent = (restaurantId: string, event: Omit<RealtimeEvent, 'restaurantId'>) => {
  initRedisRealtimeBridge();
  const nextEvent = {
    restaurantId,
    eventId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sourceInstanceId: instanceId,
    ...event,
  } as RealtimeEvent;

  publishLocalEvent(nextEvent);
  logger.info('Realtime event emitted', {
    eventId: nextEvent.eventId,
    type: nextEvent.type,
    restaurantId: nextEvent.restaurantId,
    userId: nextEvent.userId,
  });

  const redis = getRedisClient();
  if (redis) {
    redis.publish(redisBroadcastChannel, JSON.stringify(nextEvent)).catch(() => {
      // ignore redis publish errors to keep request flow resilient
    });
  }
};

export const onRestaurantEvent = (restaurantId: string, listener: (event: RealtimeEvent) => void) => {
  initRedisRealtimeBridge();
  const channel = getRestaurantChannel(restaurantId);
  emitter.on(channel, listener);
  return () => emitter.off(channel, listener);
};

export const onUserEvent = (userId: string, listener: (event: RealtimeEvent) => void) => {
  initRedisRealtimeBridge();
  const channel = getUserChannel(userId);
  emitter.on(channel, listener);
  return () => emitter.off(channel, listener);
};

export const getBufferedEvents = (input: {
  restaurantId: string;
  userId?: string;
  sinceEventId?: string;
}) => {
  const merged: RealtimeEvent[] = [];
  const seenIds = new Set<string>();
  const register = (event: RealtimeEvent) => {
    if (!event.eventId) return;
    if (seenIds.has(event.eventId)) return;
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

  if (!input.sinceEventId) return sorted;
  const index = sorted.findIndex((event) => event.eventId === input.sinceEventId);
  if (index === -1) return sorted;
  return sorted.slice(index + 1);
};
