"use client";

import { WifiOff } from "lucide-react";
import { useOnline } from "@/shared/hooks/use-online";

// Franja "Sin conexión" de los dos lados (Fase 11, T-11.2.1). Va arriba de la pantalla, en el flujo de la
// página, para no tapar la barra de arriba. Lo escrito se queda en pantalla mientras vuelve el internet.
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-secondary px-4 py-2 text-center text-14 text-secondary-foreground"
    >
      <WifiOff aria-hidden className="size-4 shrink-0" />
      <p>
        <span className="font-bold">Sin conexión.</span> Lo que escribas se
        queda aquí; guárdalo cuando vuelva el internet.
      </p>
    </div>
  );
}
