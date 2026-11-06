import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PageSkeletonProps {
  /** El ancho del contenido de esa zona (720 px el negocio y los clientes, 480 px el enlace). */
  className?: string;
}

// Esqueleto de una pantalla con datos mientras llega del servidor (los loading.tsx de /pro, /app y
// /n). Sin él, Next espera a terminar la página nueva antes de cambiar y lo tocado parece congelado;
// con él, la pantalla cambia al instante: la barra de 56 px, un bloque de filtros y tarjetas, y los
// datos llegan dentro. Aprendido en AgedaCol (6-nov).
/**
 * Filas en esqueleto para la parte de una pantalla que cambia con una pestaña o un filtro mientras
 * llega del servidor (PendingArea, Fase 17).
 */
export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Cargando" className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, row) => (
        <Skeleton key={row} className="h-14 rounded-card" />
      ))}
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

export function PageSkeleton({ className }: PageSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className="flex min-h-dvh flex-col"
    >
      <div
        aria-hidden
        className="sticky top-0 z-30 grid min-h-14 grid-cols-[44px_1fr_44px] items-center gap-2 bg-surface px-3 shadow-card"
      >
        <Skeleton className="size-6 justify-self-center rounded-full" />
        <Skeleton className="h-5 w-32 justify-self-center" />
        <span />
      </div>
      <div
        aria-hidden
        className={cn(
          "mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-3 px-4 py-4 md:py-6",
          className,
        )}
      >
        <Skeleton className="h-10 w-3/4 self-center rounded-full" />
        <Skeleton className="h-28 rounded-sheet" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-sheet" />
          <Skeleton className="h-24 rounded-sheet" />
        </div>
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-14 rounded-card" />
        ))}
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
