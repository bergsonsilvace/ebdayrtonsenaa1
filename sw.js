// EBD Frequência — Service Worker v4.0
// Mudança principal em relação à v3: o HTML principal (o app em si) agora usa
// estratégia "rede primeiro, cache como reserva" — assim, sempre que o aluno
// abrir o app COM internet, ele recebe a versão mais recente na hora, sem
// precisar fechar/abrir de novo. O cache só entra em ação quando não há conexão.
const CACHE = 'ebd-v4';

const CACHEAR = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Instalação — cachear arquivos essenciais e assumir controle imediatamente
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(CACHEAR);
    }).then(function() {
      return self.skipWaiting();
    }).catch(function(err) {
      console.log('Cache install error:', err);
    })
  );
});

// Ativação — apagar QUALQUER cache de versão anterior (ebd-v1, ebd-v2, ebd-v3...)
// e assumir controle de todas as abas já abertas sem precisar de F5 manual.
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

// Fetch — estratégia por tipo de recurso
self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  var req = e.request;

  // Supabase / Google APIs — NUNCA interceptar, sempre direto pra rede
  if (url.includes('supabase.co') ||
      url.includes('supabase.in') ||
      url.includes('googleapis.com')) {
    return;
  }

  // Só GET
  if (req.method !== 'GET') return;

  // Navegação (abrir/recarregar o app) e o próprio index.html:
  // REDE PRIMEIRO. Se der certo, atualiza o cache e devolve a versão fresca.
  // Só usa o cache se estiver realmente offline.
  var ehNavegacao = req.mode === 'navigate' || url.endsWith('/') || url.endsWith('/index.html');
  if (ehNavegacao) {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) { cache.put(req, clone); });
        }
        return response;
      }).catch(function() {
        // Sem internet — usa o que tiver no cache
        return caches.match(req).then(function(cached) {
          return cached || caches.match('/');
        });
      })
    );
    return;
  }

  // Demais recursos estáticos (ícones, manifest etc.): cache primeiro,
  // atualizando em segundo plano — não são o "miolo" do app, então não
  // precisam ser sempre os mais recentes na hora.
  e.respondWith(
    caches.match(req).then(function(cached) {
      var fetchPromise = fetch(req).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) { cache.put(req, clone); });
        }
        return response;
      }).catch(function() { return cached; });
      return cached || fetchPromise;
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
