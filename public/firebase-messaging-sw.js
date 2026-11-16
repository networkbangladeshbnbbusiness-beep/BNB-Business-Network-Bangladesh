/* BNB Business Network Bangladesh - Firebase Cloud Messaging Service Worker */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  try {
    const payload = event.data ? event.data.json() : {};
    const title = payload?.notification?.title || payload?.data?.title || 'BNB Notification';
    const body = payload?.notification?.body || payload?.data?.body || '';
    const icon = payload?.notification?.icon || '/pwa-192x192.png';
    if (title || body) {
      event.waitUntil(
        self.registration.showNotification(title, {
          body,
          icon,
          badge: '/pwa-192x192.png',
          data: payload?.data || {}
        })
      );
    }
  } catch (e) {
    // Ignore non-JSON push payload
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
