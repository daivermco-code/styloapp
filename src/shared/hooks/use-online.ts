"use client";

import { useSyncExternalStore } from "react";

/** Avisa cada vez que el navegador pierde o recupera la conexión. Devuelve cómo dejar de escuchar. */
export function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function getOnline(): boolean {
  return navigator.onLine;
}

/** En el servidor no se sabe: se supone que hay conexión. */
export function getServerOnline(): boolean {
  return true;
}

/**
 * true mientras el navegador tiene conexión (Fase 11, T-11.2.1). En el servidor y mientras React toma la
 * página dice true, para que la franja "Sin conexión" no salga de más en el HTML.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnline, getServerOnline);
}
