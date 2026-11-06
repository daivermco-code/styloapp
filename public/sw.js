// Service worker de StyloApp (Fase 11, T-11.1.2). Pequeño y sin librerías.
// - Guarda lo que no cambia (código y estilos de /_next/static/, fuentes e íconos): primero lo guardado.
// - Las páginas van primero a la red; sin conexión responden la página /sin-conexion, guardada al instalar.
// - Nunca guarda páginas con datos, Server Actions (POST), respuestas RSC ni nada de Supabase (otro origen).
// - La versión llega en la dirección (/sw.js?v=...): una versión nueva se instala, toma el control y borra
//   las cachés de la anterior.

const VERSION =
  new URL(self.location.href).searchParams.get("v") || "sin-version";
const CACHE = `styloapp-${VERSION}`;
const OFFLINE_URL = "/sin-conexion";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("styloapp-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Archivos que no cambian dentro de una versión: se pueden guardar. */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/apple-icon.png" ||
    url.pathname === "/favicon.ico"
  );
}

/** Pedidos de datos de Next (RSC y prefetch): siempre a la red y nunca a la caché. */
function isNextData(request, url) {
  return (
    request.headers.has("RSC") ||
    request.headers.has("Next-Router-State-Tree") ||
    url.searchParams.has("_rsc")
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstPage(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNextData(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});
