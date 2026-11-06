"use client";

import { RotateCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/shared/hooks/use-online";

// Si una pantalla falla (Fase 11), en vez del error genérico del navegador sale este aviso con
// "Reintentar". Sin internet lo dice claro. Las pantallas que guardan ya avisan sin perder lo escrito
// (useActionTransition); este es el respaldo para lo demás.
export default function ErrorPage({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const online = useOnline();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-6">
      <section className="flex w-full max-w-sm flex-col items-center gap-4 rounded-card border border-line bg-surface px-6 py-8 text-center">
        {online ? null : (
          <WifiOff aria-hidden className="size-8 text-primary" />
        )}
        <h1 className="text-22 font-bold text-primary">
          {online ? "Algo salió mal" : "Sin conexión"}
        </h1>
        <p className="text-14 text-slate">
          {online
            ? "No se pudo abrir esta pantalla. Vuelve a intentarlo."
            : "No hay internet en este momento. Revisa el wifi o los datos y vuelve a intentarlo."}
        </p>
        <Button type="button" className="w-full" onClick={() => retry()}>
          <RotateCw aria-hidden />
          Reintentar
        </Button>
      </section>
    </main>
  );
}
