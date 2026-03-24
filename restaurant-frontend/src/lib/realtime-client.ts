import { io, Socket } from 'socket.io-client';
import { apiClient, Order } from '@/lib/api-client';

export type OrderRealtimeEvent = {
  eventId?: string;
  sourceInstanceId?: string;
  type: string;
  restaurantId: string;
  userId?: string;
  payload: {
    order?: Partial<Order> & { id: string };
    [key: string]: any;
  };
};

type OrderEventHandler = (event: OrderRealtimeEvent) => void;

let socket: Socket | null = null;
let currentToken: string | null = null;
const restaurantRefs = new Map<string, number>();

const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
};

const createSocket = (token: string) => {
  const next = io(apiClient.getBaseURL(), {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    upgrade: true,
    reconnection: true,
    timeout: 10000,
    auth: { token },
  });

  next.on('connect', () => {
    restaurantRefs.forEach((count, restaurant) => {
      if (count > 0) {
        next.emit('restaurant.join', { restaurant });
      }
    });
  });

  return next;
};

const ensureSocket = () => {
  if (typeof window === 'undefined') return null;
  const token = getToken();
  if (!token) return null;

  if (!socket) {
    socket = createSocket(token);
    currentToken = token;
    return socket;
  }

  if (currentToken !== token) {
    socket.disconnect();
    socket = createSocket(token);
    currentToken = token;
  }

  return socket;
};

const joinRestaurant = (restaurant: string) => {
  const next = ensureSocket();
  if (!next) return;

  const refCount = (restaurantRefs.get(restaurant) || 0) + 1;
  restaurantRefs.set(restaurant, refCount);
  if (refCount === 1) {
    next.emit('restaurant.join', { restaurant });
  }
};

const leaveRestaurant = (restaurant: string) => {
  const next = ensureSocket();
  if (!next) return;

  const refCount = (restaurantRefs.get(restaurant) || 0) - 1;
  if (refCount <= 0) {
    restaurantRefs.delete(restaurant);
    next.emit('restaurant.leave', { restaurant });
    return;
  }
  restaurantRefs.set(restaurant, refCount);
};

export const subscribeToOrderEvents = (options: {
  restaurant?: string | null;
  scope?: 'restaurant' | 'user' | 'both';
  onEvent: OrderEventHandler;
}) => {
  const next = ensureSocket();
  if (!next) return () => {};

  const scope = options.scope || 'restaurant';
  const restaurant = options.restaurant?.trim().toLowerCase() || null;

  if ((scope === 'restaurant' || scope === 'both') && restaurant) {
    joinRestaurant(restaurant);
  }

  const handler = (event: OrderRealtimeEvent) => {
    options.onEvent(event);
  };

  next.on('order.created', handler);
  next.on('order.updated', handler);

  return () => {
    next.off('order.created', handler);
    next.off('order.updated', handler);
    if ((scope === 'restaurant' || scope === 'both') && restaurant) {
      leaveRestaurant(restaurant);
    }
  };
};

export const subscribeToRestaurantEvents = (options: {
  restaurant?: string | null;
  eventTypes: string[];
  onEvent: OrderEventHandler;
}) => {
  const next = ensureSocket();
  if (!next) return () => {};

  const restaurant = options.restaurant?.trim().toLowerCase() || null;
  if (restaurant) {
    joinRestaurant(restaurant);
  }

  const handler = (event: OrderRealtimeEvent) => {
    options.onEvent(event);
  };

  options.eventTypes.forEach((eventName) => next.on(eventName, handler));

  return () => {
    options.eventTypes.forEach((eventName) => next.off(eventName, handler));
    if (restaurant) {
      leaveRestaurant(restaurant);
    }
  };
};
