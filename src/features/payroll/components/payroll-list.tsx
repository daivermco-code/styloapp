import { ChevronRight, TriangleAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/components/empty-state";
import { formatCOP } from "@/shared/lib/money";
import { pendingSummary, unmarkedText } from "../lib/payroll";
import type { PayrollRow } from "../types/payroll";
import { InstantLink } from "@/shared/components/instant-nav";
import { NAV_GROUP } from "@/shared/lib/instant-nav";

export const NO_TEAM = "Aún no tienes profesionales en tu equipo.";
const NOTHING_PENDING = "Sin comisiones pendientes";

/** La inicial del profesional en un círculo de 44 px (liquidador e historial de pagos). */
export function Initial({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-16 font-bold text-primary"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function PayrollCard({ row }: { row: PayrollRow }) {
  const opens = row.pending > 0 || row.unmarked > 0;
  const content = (
    <>
      <span className="flex items-center gap-3 px-4 py-3">
        <Initial name={row.name} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-16 font-bold text-ink">
            {row.name}
            {!row.isActive && (
              <span className="font-medium text-slate"> (inactivo)</span>
            )}
          </span>
          <span className="text-12 text-slate">
            {row.pending > 0
              ? pendingSummary(row.items, row.invoices, row.since)
              : NOTHING_PENDING}
          </span>
        </span>
        <span className="shrink-0 text-16 font-bold text-primary">
          {formatCOP(row.pending)}
        </span>
        {opens && (
          <ChevronRight className="size-5 shrink-0 text-slate" aria-hidden />
        )}
      </span>
      {row.unmarked > 0 && (
        <span className="flex items-center gap-2 rounded-b-card border-t border-warning/30 bg-warning/10 px-4 py-2 text-14 text-ink">
          <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden />
          <span>
            <span className="font-bold">{unmarkedText(row.unmarked)}</span>
            {" · "}Márcalas antes de pagarle
          </span>
        </span>
      )}
    </>
  );
  const card =
    "flex flex-col rounded-card border border-line bg-surface shadow-card";
  if (!opens) return <div className={card}>{content}</div>;
  return (
    <InstantLink
      href={`/pro/liquidador?pro=${row.staffId}`}
      group={NAV_GROUP.payroll}
      selectable={false}
      className={cn(
        card,
        "transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {content}
    </InstantLink>
  );
}

// Lista del liquidador (T-9.2.1, US-045, pantalla 12): una tarjeta por profesional, sin el dueño,
// con lo pendiente, de cuántos servicios y facturas sale, y la fila ámbar de las citas sin marcar. Sin nada
// pendiente ni citas por marcar, la tarjeta solo se lee.
export function PayrollList({ rows }: { rows: PayrollRow[] }) {
  if (rows.length === 0) return <EmptyState message={NO_TEAM} />;
  return (
    <ul className="flex flex-col gap-3 pb-24">
      {rows.map((row) => (
        <li key={row.staffId}>
          <PayrollCard row={row} />
        </li>
      ))}
    </ul>
  );
}

// Mientras llega el liquidador: tres tarjetas en esqueleto, nunca ceros.
export function PayrollListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando el liquidador"
      className="flex flex-col gap-3"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-card border border-line px-4 py-3"
        >
          <Skeleton className="size-11 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40 max-w-full" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
