import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Lo que comparten Ventas, Comisiones y Métodos de pago (T-13.2.1, UI Pantalla 20).

/** "No hay reporte para la fecha seleccionada" en 18 grafito centrado, como las capturas 73 a 75. */
export function ReportEmpty({
  message = "No hay reporte para la fecha seleccionada",
}: {
  message?: string;
}) {
  return <p className="px-5 py-12 text-center text-18 text-ink">{message}</p>;
}

/** La tarjeta blanca de la lista, con la línea de totales arriba y las filas debajo. */
export function ReportList({
  label,
  summary,
  children,
}: {
  label: string;
  /** "Total $ 1.250.000 · 18 facturas", con el valor en Bold 16 principal. */
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="overflow-hidden rounded-sheet bg-surface shadow-card"
    >
      <p className="border-b border-line px-5 py-4 text-14 text-slate md:px-6">
        {summary}
      </p>
      <ul className="divide-y divide-line">{children}</ul>
    </section>
  );
}

/** Un valor dentro de la línea de totales: Bold 16 principal. */
export function Strong({ children }: { children: ReactNode }) {
  return (
    <strong className="whitespace-nowrap text-16 font-bold text-primary">
      {children}
    </strong>
  );
}

/** Mientras llegan: la línea de totales y 4 filas en gris. */
export function ReportListSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 rounded-sheet bg-surface p-5 shadow-card"
      aria-busy="true"
      aria-label="Cargando el informe"
    >
      <Skeleton className="h-6 w-2/3" />
      {[0, 1, 2, 3].map((row) => (
        <Skeleton key={row} className="h-12" />
      ))}
    </div>
  );
}

/** "1 factura" o "18 facturas". */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
