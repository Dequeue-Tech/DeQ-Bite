self.addEventListener('push', (event) => {
  const fallback = {
    title: 'Order update',
    body: 'You have a new order notification.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'order-update',
    data: { url: '/orders' },
  };

  let payload = fallback;
  if (event.data) {
    try {
      payload = { ...fallback, ...event.data.json() };
    } catch (_error) {
      payload = fallback;
    }
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon,
        badge: payload.badge,
        tag: payload.tag,
        data: payload.data,
        renotify: true,
      }),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) =>
        Promise.all(
          clients.map((client) =>
            client.postMessage({
              type: 'push:order',
              payload,
            })
          )
        )
      ),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification?.data?.url;
  const destination = typeof rawUrl === 'string' && rawUrl.trim() ? rawUrl : '/orders';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(destination);
      }
      return undefined;
    })
  );
});
