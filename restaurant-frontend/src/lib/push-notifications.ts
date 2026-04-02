import { apiClient, PushRoleScope, PushSubscriptionPayload } from '@/lib/api-client';

const isPushSupported = () =>
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window;

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const toPayload = (subscription: PushSubscription): PushSubscriptionPayload => {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Invalid push subscription payload');
  }
  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
};

const ensureServiceWorker = async () => {
  const registration = await navigator.serviceWorker.register('/sw.js');
  return registration;
};

export const ensurePushSubscription = async (roleScope: PushRoleScope) => {
  if (!isPushSupported()) {
    throw new Error('Browser push notifications are not supported');
  }

  const currentPermission = Notification.permission;
  if (currentPermission === 'denied') {
    throw new Error('Notifications are blocked. Enable them in browser settings.');
  }

  if (currentPermission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission was not granted.');
    }
  }

  const registration = await ensureServiceWorker();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const vapidPublicKey = await apiClient.getPushVapidPublicKey();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const payload = toPayload(subscription);
  await apiClient.subscribeToPush({ roleScope, subscription: payload });
  return payload.endpoint;
};

export const syncPushSubscriptionIfGranted = async (roleScope: PushRoleScope) => {
  if (!isPushSupported()) return;
  if (Notification.permission !== 'granted') return;

  const registration = await ensureServiceWorker();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const vapidPublicKey = await apiClient.getPushVapidPublicKey();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }
  await apiClient.subscribeToPush({ roleScope, subscription: toPayload(subscription) });
};
