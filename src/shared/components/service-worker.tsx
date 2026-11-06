"use client";

import { useEffect } from "react";

// Registra el service worker de la app instalable (Fase 11, T-11.1.2), solo en producción. En desarrollo
// quita el que haya quedado de un `npm start`, para que no sirva archivos viejos mientras se programa.
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((r) => r.unregister())),
        );
      return;
    }
    const version = encodeURIComponent(
      process.env.NEXT_PUBLIC_APP_VERSION ?? "",
    );
    navigator.serviceWorker
      .register(`/sw.js?v=${version}`, { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Sin service worker la app funciona igual, solo que sin la página "Sin conexión".
      });
  }, []);

  return null;
}
