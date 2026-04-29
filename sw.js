// EBD Frequência — Service Worker v2.0
const CACHE = 'ebd-v2';

// Instalação — cachear a página principal
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(['/']);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Ativação — limpar caches antigos
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
          .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch — cache first para HTML, network first para Supabase
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Supabase — sempre online, nunca cachear
  if (url.includes('supabase.co')) return;

  // Só GET
  if (e.request.method !== 'GET') return;

  e.respondWith(
    // Tentar rede primeiro
    fetch(e.request).then(function(response) {
      // Se deu certo, cachear e retornar
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE).then(function(cache) {
          cache.put(e.request, clone);
        });
      }
      return response;
    }).catch(function() {
      // Sem internet — retornar do cache
      return caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        // Fallback para a página principal
        return caches.match('/');
      });
    })
  );
});

// Push notification
self.addEventListener('push', function(e) {
  var data = { title: 'EBD Frequência', body: 'Nova notificação' };
  try { if (e.data) data = Object.assign(data, e.data.json()); } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'ebd-notif'
    })
  );
});

// Clique na notificação
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(list) {
      for (var c of list) {
        if ('focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
