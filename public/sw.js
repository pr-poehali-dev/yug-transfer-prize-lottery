self.addEventListener('push', function(event) {
  if (!event.data) return;
  const data = event.data.json();
  const title = data.title || 'Уведомление';
  const options = {
    body: data.body || '',
    icon: '/favicon-kb.png',
    badge: '/favicon-kb.png',
    tag: data.tag || 'yug-transfer',
    renotify: true,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});