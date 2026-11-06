"use client";

import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import {
  isNetworkError,
  OFFLINE_NOT_SAVED,
  OFFLINE_TITLE,
} from "@/shared/lib/network-error";

type Action = () => void | Promise<void>;

/**
 * Como useTransition, para llamar Server Actions (Fase 11, T-11.2.1). Si la acción no llega por falta de
 * internet, avisa "Sin conexión" y deja la pantalla como estaba, con lo escrito. Sin esto, el error de la
 * red llega al límite de errores de React y la pantalla se pierde. Los demás errores siguen su camino.
 */
export function useActionTransition(): [boolean, (action: Action) => void] {
  const [pending, startTransition] = useTransition();

  const start = useCallback((action: Action) => {
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        if (!isNetworkError(error, navigator.onLine)) throw error;
        toast.error(OFFLINE_TITLE, {
          id: "sin-conexion",
          description: OFFLINE_NOT_SAVED,
        });
      }
    });
  }, []);

  return [pending, start];
}
