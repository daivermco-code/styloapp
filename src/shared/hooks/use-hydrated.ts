"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false en el HTML del servidor y mientras React toma la página; true después. Sirve para dejar
 * desactivados los botones que no hacen nada hasta entonces (un celular lento, o una prueba).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
