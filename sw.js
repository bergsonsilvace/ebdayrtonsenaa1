// EBD Frequência — Service Worker
// Estratégia: index.html SEMPRE busca da rede (nunca cacheia), demais recursos network-first com fallback pro cache.
const CACHE = 'ebd-v2';
const OFFLINE_URL = '/';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Deletar TODOS os caches antigos (de versões anteriores do SW)
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Supabase — sempre online, nunca interceptar/cachear
  if (url.hostname.includes('supabase.co')) return;

  // index.html / raiz: SEMPRE busca da rede, nunca do cache (garante que a versão
  // publicada mais recente chegue ao aluno/professor assim que ele abrir o app)
  if (url.pathname === '/' || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Outros recursos (ícones, fontes, etc.): network first, com fallback pro cache
  e.respondWith(
    fetch(e.request).then(response => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
      }
      return response;
    }).catch(() => caches.match(e.request))
  );
});

// Push notification
self.addEventListener('push', e => {
  let data = { title: 'EBD Frequência', body: 'Nova notificação' };
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
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
