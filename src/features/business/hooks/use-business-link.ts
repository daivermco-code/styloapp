"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { copyText } from "@/shared/lib/clipboard";

const subscribe = () => () => {};

/**
 * El origen de este navegador (http://192.168.…:3000), para que los QR sirvan también desde otro
 * celular de la casa. Vacío en el servidor.
 */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
}

/** La dirección de la página de reservas del negocio (`/n/[slug]`). Vacía en el servidor. */
export function useBusinessLink(slug: string): string {
  const origin = useOrigin();
  return origin ? `${origin}/n/${slug}` : "";
}

/** "Compartir enlace" (US-008): copia la dirección y avisa. */
export function useShareLink(slug: string): () => Promise<void> {
  const link = useBusinessLink(slug);
  return async () => {
    if (link && (await copyText(link))) {
      toast.success("Enlace copiado");
      return;
    }
    toast.error("No se pudo copiar el enlace. Inténtalo de nuevo.");
  };
}
