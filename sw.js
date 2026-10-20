// Guarda los archivos del juego para jugar sin conexión.
// Pide primero la versión nueva a la red y, si no hay conexión, usa la copia guardada.
// ARCHIVOS y CACHE los escribe herramientas/cache.js: córrelo después de cambiar cualquier archivo del juego.
const CACHE = 'reliquias-25fc5b912a';
const ARCHIVOS = [
  './', 'index.html', 'css/estilo.css', 'manifest.webmanifest', 'js/acertijos.js', 'js/arma.js',
  'js/audio.js', 'js/automapa.js', 'js/entrada.js', 'js/escena.js', 'js/etiquetas.js', 'js/fauna.js',
  'js/hitos.js', 'js/juego.js', 'js/laberinto.js', 'js/main.js', 'js/mapa.js', 'js/musica.js',
  'js/palancas.js', 'js/red.js', 'js/render.js', 'js/texturas.js', 'js/vendor/peerjs.min.js',
  'datos/emblemas.js', 'datos/mazmorras.js', 'datos/museo.js', 'datos/pistas.js', 'datos/red.js',
  'datos/tesoros.js', 'iconos/icono-192.png', 'iconos/icono-512.png', 'iconos/idolo.svg',
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
