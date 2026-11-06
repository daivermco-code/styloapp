"use client";

import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Si los contadores no cargan, quedan con "–" y este aviso para volver a pedirlos (UI pantalla 2).
export function CountersError() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <p
      role="alert"
      className="mt-3 flex flex-wrap items-center justify-center gap-x-2 text-12 text-slate"
    >
      No se pudieron cargar los números.
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
        className="inline-flex min-h-11 items-center gap-1 font-bold text-primary"
      >
        <RotateCw className={pending ? "size-4 animate-spin" : "size-4"} />
        Reintentar
      </button>
    </p>
  );
}
