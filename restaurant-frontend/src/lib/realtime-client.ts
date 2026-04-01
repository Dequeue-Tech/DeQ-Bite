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
type StreamScope = 'restaurant' | 'user' | 'both';

type StreamSubscription = {
  id: string;
  scope: StreamScope;
  restaurant?: string | null;
  eventTypes?: Set<string>;
  onEvent: OrderEventHandler;
};

let stream: EventSource | null = null;
let streamUrl = '';
let streamRestaurant: string | null = null;
let streamToken: string | null = null;
let lastPingAt = 0;
let lastEventId: string | null = null;
let healthTimer: ReturnType<typeof setInterval> | null = null;
let bootstrapTimer: ReturnType<typeof setInterval> | null = null;
let streamSubscriptionId = 0;
const activeSubscriptions = new Map<string, StreamSubscription>();
const processedEventIds = new Map<string, number>();
const MAX_TRACKED_EVENT_IDS = 250;

const knownEventTypes = [
  'order.created',
  'order.updated',
  'invoice.ready',
  'kot.created',
  'kot.updated',
  'kot.priority.updated',
  'restaurant.users.updated',
] as const;

const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
};

const toTenantSlug = (restaurant?: string | null) => {
  const slug = (
    restaurant ||
    apiClient.getActiveRestaurantSlug() ||
    apiClient.getSelectedRestaurantSlug() ||
    ''
  ).trim().toLowerCase();
  return slug || null;
};

const trackProcessedEvent = (eventId?: string) => {
  if (!eventId) return false;
  if (processedEventIds.has(eventId)) return true;

  processedEventIds.set(eventId, Date.now());
  if (processedEventIds.size > MAX_TRACKED_EVENT_IDS) {
    const oldestKey = processedEventIds.keys().next().value;
    if (oldestKey) processedEventIds.delete(oldestKey);
  }

  return false;
};

const getScopeForAllSubscribers = (): StreamScope => {
  let hasRestaurant = false;
  let hasUser = false;

  activeSubscriptions.forEach((subscription) => {
    if (subscription.scope === 'both') {
      hasRestaurant = true;
      hasUser = true;
      return;
    }
    if (subscription.scope === 'restaurant') hasRestaurant = true;
    if (subscription.scope === 'user') hasUser = true;
  });

  if (hasRestaurant && hasUser) return 'both';
  if (hasUser) return 'user';
  return 'restaurant';
};

const getWantedEventTypes = () => {
  const eventTypes = new Set<string>();
  activeSubscriptions.forEach((subscription) => {
    subscription.eventTypes?.forEach((eventType) => eventTypes.add(eventType));
  });
  return eventTypes;
};

const buildStreamUrl = (input: {
  token: string;
  restaurant: string;
  scope: StreamScope;
  eventTypes: Set<string>;
  lastEventId?: string | null;
}) => {
  apiClient.setSelectedRestaurantSlug(input.restaurant);
  const base = apiClient.getEventStreamUrl(input.token);
  const search = new URLSearchParams();
  search.set('scope', input.scope);
  if (input.eventTypes.size > 0) {
    search.set('events', Array.from(input.eventTypes).join(','));
  }
  if (input.lastEventId) {
    search.set('lastEventId', input.lastEventId);
  }

  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${search.toString()}`;
};

const closeIfUnused = () => {
  if (activeSubscriptions.size > 0) return;

  if (stream) {
    stream.close();
    stream = null;
  }

  streamUrl = '';
  streamRestaurant = null;
  streamToken = null;
  lastPingAt = 0;
  lastEventId = null;

  if (healthTimer) {
    clearInterval(healthTimer);
    healthTimer = null;
  }
  if (bootstrapTimer) {
    clearInterval(bootstrapTimer);
    bootstrapTimer = null;
  }
};

const ensureHealthTimer = () => {
  if (healthTimer || typeof window === 'undefined') return;

  healthTimer = setInterval(() => {
    if (!stream) return;
    const currentToken = getToken();
    if (!currentToken || (streamToken && currentToken !== streamToken)) {
      stream.close();
      stream = null;
      streamUrl = '';
      streamToken = null;
      ensureStream();
      return;
    }
    if (Date.now() - lastPingAt <= 70_000) return;

    stream.close();
    stream = null;
    streamUrl = '';
    streamToken = null;
    lastPingAt = 0;
    ensureStream();
  }, 15_000);
};

const ensureBootstrapTimer = () => {
  if (bootstrapTimer || typeof window === 'undefined') return;
  bootstrapTimer = setInterval(() => {
    if (activeSubscriptions.size === 0) return;
    ensureStream();
  }, 5_000);
};

const isMatchingScope = (subscriberScope: StreamScope, event: OrderRealtimeEvent) => {
  if (subscriberScope === 'both') return true;
  if (subscriberScope === 'restaurant') return true;
  return Boolean(event.userId);
};

const ensureStream = () => {
  if (typeof window === 'undefined') return null;
  if (activeSubscriptions.size === 0) return null;

  const token = getToken();
  if (!token) return null;

  const restaurantFromSubscriptions = Array.from(activeSubscriptions.values())
    .map((subscription) => toTenantSlug(subscription.restaurant))
    .find(Boolean);

  const restaurant = restaurantFromSubscriptions || streamRestaurant || toTenantSlug();
  if (!restaurant) return null;

  const nextScope = getScopeForAllSubscribers();
  const nextStreamUrl = buildStreamUrl({
    token,
    restaurant,
    scope: nextScope,
    eventTypes: getWantedEventTypes(),
    lastEventId,
  });

  if (stream && nextStreamUrl === streamUrl) return stream;

  if (stream) {
    stream.close();
  }

  stream = new EventSource(nextStreamUrl);
  streamUrl = nextStreamUrl;
  streamToken = token;
  lastPingAt = Date.now();

  stream.addEventListener('open', () => {
    lastPingAt = Date.now();
  });

  stream.addEventListener('ping', () => {
    lastPingAt = Date.now();
  });

  stream.addEventListener('error', () => {
    // Native EventSource reconnects automatically.
  });

  const onEvent = (message: MessageEvent) => {
    lastPingAt = Date.now();

    let event: OrderRealtimeEvent;
    try {
      event = JSON.parse(message.data) as OrderRealtimeEvent;
    } catch {
      return;
    }

    if (trackProcessedEvent(event.eventId)) return;
    if (event.eventId) {
      lastEventId = event.eventId;
    }

    activeSubscriptions.forEach((subscription) => {
      if (!isMatchingScope(subscription.scope, event)) return;
      if (subscription.eventTypes && !subscription.eventTypes.has(event.type)) return;
      subscription.onEvent(event);
    });
  };

  knownEventTypes.forEach((eventType) => {
    stream?.addEventListener(eventType, onEvent);
  });

  ensureHealthTimer();
  return stream;
};

const subscribe = (options: {
  restaurant?: string | null;
  scope: StreamScope;
  eventTypes?: string[];
  onEvent: OrderEventHandler;
}) => {
  const restaurant = toTenantSlug(options.restaurant);
  if (restaurant) {
    streamRestaurant = restaurant;
  }

  const id = `sub_${++streamSubscriptionId}`;
  activeSubscriptions.set(id, {
    id,
    scope: options.scope,
    restaurant,
    eventTypes: options.eventTypes?.length ? new Set(options.eventTypes) : undefined,
    onEvent: options.onEvent,
  });

  ensureBootstrapTimer();
  ensureStream();

  return () => {
    activeSubscriptions.delete(id);
    closeIfUnused();
    ensureStream();
  };
};

export const subscribeToOrderEvents = (options: {
  restaurant?: string | null;
  scope?: 'restaurant' | 'user' | 'both';
  onEvent: OrderEventHandler;
}) => {
  return subscribe({
    restaurant: options.restaurant,
    scope: options.scope || 'restaurant',
    eventTypes: ['order.created', 'order.updated', 'invoice.ready'],
    onEvent: options.onEvent,
  });
};

export const subscribeToRestaurantEvents = (options: {
  restaurant?: string | null;
  eventTypes: string[];
  onEvent: OrderEventHandler;
}) => {
  return subscribe({
    restaurant: options.restaurant,
    scope: 'restaurant',
    eventTypes: options.eventTypes,
    onEvent: options.onEvent,
  });
};
