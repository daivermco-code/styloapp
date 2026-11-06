"use client";

import { CircleCheck, CircleAlert, Info } from "lucide-react";
import { Toaster } from "sonner";

// Aviso flotante (DESIGN.md §6): baja desde arriba, se queda 3 s; éxito con chulo verde. Lleva borde y
// la sombra mayor: casi siempre cae sobre una pantalla blanca, y con la sombra suave no se distinguía.
export function BrandToaster() {
  return (
    <Toaster
      position="top-center"
      // Los colores salen de los tokens (siguen el modo solos); con "system" sonner tampoco pinta nada claro.
      theme="system"
      duration={3000}
      icons={{
        success: <CircleCheck className="size-5 text-success" />,
        error: <CircleAlert className="size-5 text-danger" />,
        info: <Info className="size-5 text-primary" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-start gap-3 rounded-card border border-line bg-surface p-4 font-sans text-14 text-ink shadow-card-hover",
          title: "font-bold",
          description: "text-14 text-slate",
          actionButton: "font-bold text-primary",
        },
      }}
    />
  );
}
