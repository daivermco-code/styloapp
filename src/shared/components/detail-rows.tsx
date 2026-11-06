import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DetailRow {
  label: string;
  value: ReactNode;
}

interface DetailRowsProps {
  rows: DetailRow[];
  className?: string;
}

// Detalle en filas (UI-styloapp.md §4): etiqueta gris 14, valor grafito 16.
export function DetailRows({ rows, className }: DetailRowsProps) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-4 py-3"
        >
          <dt className="text-14 text-slate">{row.label}</dt>
          <dd className="text-right text-16 text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
