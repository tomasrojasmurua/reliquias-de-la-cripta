// Guarda los archivos del juego para jugar sin conexión.
// Pide primero la versión nueva a la red y, si no hay conexión, usa la copia guardada.
// Si agregas un archivo que el juego necesita, añádelo a ARCHIVOS y sube el número de CACHE.
const CACHE = 'reliquias-v16';
const ARCHIVOS = [
  './', 'index.html', 'css/estilo.css', 'manifest.webmanifest',
  'js/main.js', 'js/render.js', 'js/texturas.js', 'js/mapa.js', 'js/juego.js', 'js/entrada.js',
  'js/arma.js', 'js/audio.js', 'js/acertijos.js', 'js/automapa.js', 'js/laberinto.js', 'js/escena.js',
  'datos/mazmorras.js', 'datos/tesoros.js', 'datos/pistas.js',
  'iconos/icono-192.png', 'iconos/icono-512.png', 'iconos/idolo.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request))
  );
});
