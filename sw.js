/**
 * sw.js — Service worker: hace que Finax abra sin internet.
 *
 * Estrategia "stale-while-revalidate": responde al instante con lo guardado y,
 * por detrás, descarga la versión nueva para la próxima vez que abras la app.
 * Al publicar cambios grandes, sube el número de CACHE para limpiar lo viejo.
 */
const CACHE = 'finax-v3';
const ARCHIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/datos.js',
  'js/calculos.js',
  'js/formato.js',
  'js/graficas.js',
  'js/iconos.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const peticion = e.request;
  if (peticion.method !== 'GET' || new URL(peticion.url).origin !== location.origin) return;
  const deRed = fetch(peticion).then(async (respuesta) => {
    if (respuesta.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(peticion, respuesta.clone());
    }
    return respuesta;
  });
  e.waitUntil(deRed.catch(() => {}));
  e.respondWith(
    caches.match(peticion, { ignoreSearch: true }).then((guardada) =>
      guardada || deRed.catch(() => (peticion.mode === 'navigate' ? caches.match('./') : Response.error()))),
  );
});
