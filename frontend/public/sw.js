// Service worker mínimo — só pra satisfazer o critério de instalabilidade do PWA.
// Lighthouse/Chrome exigem um SW que pelo menos escute "fetch"; este aqui passa adiante,
// network-first sem cache complexo. Sem push, sem background sync.
// Cache leve só do shell (index.html) pra abertura offline básica do PWA instalado.

const CACHE_NAME = 'lasanharia-shell-v1';
const SHELL = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Pula chamadas de API e tudo que não é GET — vai direto pra rede.
  if (req.method !== 'GET' || new URL(req.url).pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(req)
      .then((res) => res)
      .catch(() => caches.match(req).then((cached) => cached ?? caches.match('/'))),
  );
});
