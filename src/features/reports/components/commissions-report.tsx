import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCOP } from "@/shared/lib/money";
import { getCommissionsReport, type ReportArgs } from "../services/queries";
import type { CommissionReportRow } from "../types/report";
import { ReportEmpty, ReportList, Strong } from "./report-parts";

/** Fila de comisiones (UI B.1): avatar de 40 px, nombre y lo vendido; a la derecha lo ganado. */
function CommissionRow({ row }: { row: CommissionReportRow }) {
  return (
    <li className="flex min-h-16 items-center gap-3 px-5 py-3 md:px-6">
      <Avatar className="size-10 text-16">
        <AvatarFallback>{row.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-16 text-ink">{row.name}</span>
        <span className="text-12 text-slate">Vendió {formatCOP(row.sold)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        <span className="text-16 font-bold text-primary">
          <span className="sr-only">Ganó </span>
          {formatCOP(row.earned)}
        </span>
        <span className="text-12 text-slate">
          Pagado {formatCOP(row.paid)} ·{" "}
          <span className="font-bold text-primary">
            Falta {formatCOP(row.pending)}
          </span>
        </span>
      </span>
    </li>
  );
}

// Comisiones, el reporte de pagos (T-13.2.1, US-055, Pantalla 20): por profesional lo que vendió,
// la comisión ganada, lo ya pagado por el liquidador y lo que falta. El dueño no sale. Arriba,
// los totales. El profesional ve solo su fila (la base no le da las demás).
export async function CommissionsReport({ args }: { args: ReportArgs }) {
  const rows = await getCommissionsReport(args);
  if (rows.length === 0) return <ReportEmpty />;
  const sum = (pick: (row: CommissionReportRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);
  return (
    <ReportList
      label="Comisiones por profesional"
      summary={
        <>
          Ganado <Strong>{formatCOP(sum((row) => row.earned))}</Strong> · Pagado{" "}
          <Strong>{formatCOP(sum((row) => row.paid))}</Strong> · Falta{" "}
          <Strong>{formatCOP(sum((row) => row.pending))}</Strong>
        </>
      }
    >
      {rows.map((row) => (
        <CommissionRow key={row.staffId} row={row} />
      ))}
    </ReportList>
  );
}
