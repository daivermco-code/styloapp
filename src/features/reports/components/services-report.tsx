import { MoneyRow } from "@/shared/components/money-row";
import { formatCOP } from "@/shared/lib/money";
import {
  getReportSummary,
  getServicesReport,
  type ReportArgs,
} from "../services/queries";
import { plural, ReportEmpty, ReportList, Strong } from "./report-parts";

// Ventas (T-13.2.1, US-054, Pantalla 20): arriba el total y cuántas facturas; debajo una fila por
// servicio con cuántas veces se vendió y su total, de mayor a menor (así lo ordena la base).
export async function ServicesReport({ args }: { args: ReportArgs }) {
  const [rows, summary] = await Promise.all([
    getServicesReport(args),
    getReportSummary(args),
  ]);
  if (rows.length === 0) return <ReportEmpty />;
  return (
    <ReportList
      label="Ventas por servicio"
      summary={
        <>
          Total <Strong>{formatCOP(summary.services)}</Strong> ·{" "}
          {plural(summary.invoices, "factura", "facturas")}
        </>
      }
    >
      {rows.map((row) => (
        <li key={row.serviceId}>
          <MoneyRow
            title={row.name}
            detail={plural(row.times, "vez", "veces")}
            value={row.total}
          />
        </li>
      ))}
    </ReportList>
  );
}
