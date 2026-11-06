import { MoneyRow } from "@/shared/components/money-row";
import { formatCOP } from "@/shared/lib/money";
import { methodShares } from "../lib/display";
import { getMethodsReport, type ReportArgs } from "../services/queries";
import { plural, ReportEmpty, ReportList, Strong } from "./report-parts";

// Métodos de pago (T-13.2.1, US-056, Pantalla 20): una fila por método con el total, cuántas
// facturas y su porcentaje (suman 100). Salen los activos y los desactivados que tuvieron ventas.
// Es del negocio: con un profesional elegido, una línea dice que se ve con "Todos".
export async function MethodsReport({ args }: { args: ReportArgs }) {
  if (args.staffId) {
    return (
      <ReportEmpty message="Los métodos de pago son del negocio: elige Todos para verlos." />
    );
  }
  const rows = await getMethodsReport(args);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  if (total === 0) return <ReportEmpty />;
  const invoices = rows.reduce((sum, row) => sum + row.invoices, 0);
  const shares = methodShares(rows.map((row) => row.total));
  return (
    <ReportList
      label="Ventas por método de pago"
      summary={
        <>
          Total <Strong>{formatCOP(total)}</Strong> ·{" "}
          {plural(invoices, "factura", "facturas")}
        </>
      }
    >
      {rows.map((row, index) => (
        <li key={row.methodId}>
          <MoneyRow
            title={row.isActive ? row.name : `${row.name} (inactivo)`}
            detail={`${plural(row.invoices, "factura", "facturas")} · ${shares[index]} %`}
            value={row.total}
          />
        </li>
      ))}
    </ReportList>
  );
}
