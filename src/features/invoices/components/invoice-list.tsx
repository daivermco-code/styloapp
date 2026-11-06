import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/shared/components/empty-state";
import { MoneyRow } from "@/shared/components/money-row";
import { TotalsFooter } from "@/shared/components/totals-footer";
import type { PeriodRange } from "@/shared/lib/periods";
import { arrangeInvoices, type InvoiceView } from "../lib/filters";
import { invoiceTitle, periodTotals } from "../lib/totals";
import { getInvoiceList } from "../services/queries";
import type { InvoiceListItem, InvoiceViewer } from "../types/invoice";
import { EMPTY_PERIOD } from "../types/messages";

function detailOf(invoice: InvoiceListItem): string {
  return [invoice.clientName, invoice.services.join(", ")]
    .filter(Boolean)
    .join(" · ");
}

interface InvoiceListProps {
  viewer: InvoiceViewer;
  view: InvoiceView;
  range: PeriodRange;
  /** El profesional que se mira: el elegido por el dueño, o el propio profesional. */
  staffId: string | null;
  /** En la columna "Facturas de hoy" del editor, el pie no sube el botón de la bandeja. */
  liftsInbox?: boolean;
}

// Lista de Facturas del periodo (T-8.2.1, US-042, pantalla 7): "Factura 0012 · Efectivo", el
// cliente y los servicios en 12 gris, y el valor; la anulada, tachada. Abajo, el pie con "Total
// ventas" y "Total comisiones" del periodo sin las anuladas, aunque la hoja filtre otra cosa.
// Cada fila abre el detalle (US-043).
export async function InvoiceList({
  viewer,
  view,
  range,
  staffId,
  liftsInbox = true,
}: InvoiceListProps) {
  const invoices = await getInvoiceList(viewer, range, staffId);
  const shown = arrangeInvoices(invoices, view.filter, view.order);
  const totals = periodTotals(invoices);

  return (
    <>
      {shown.length === 0 ? (
        <EmptyState message={EMPTY_PERIOD} className="flex-1" />
      ) : (
        // pb-14: al final, la última fila queda encima del botón de la bandeja de la demo.
        <ul className="flex-1 divide-y divide-line pb-14">
          {shown.map((invoice) => (
            <li key={invoice.id}>
              <MoneyRow
                title={`${invoiceTitle(invoice.number)} · ${invoice.methodName}`}
                detail={detailOf(invoice)}
                value={invoice.value}
                voided={invoice.status === "void"}
                href={`/pro/facturas/${invoice.id}`}
              />
            </li>
          ))}
        </ul>
      )}
      <TotalsFooter
        label="Totales del periodo"
        besideFab
        liftsInbox={liftsInbox}
        rows={[
          { label: "Total ventas", value: totals.sales },
          { label: "Total comisiones", value: totals.commissions },
        ]}
      />
    </>
  );
}

// Mientras llega el periodo: esqueleto de 4 filas (UI pantalla 7), nunca ceros.
export function InvoiceListSkeleton({
  liftsInbox = true,
}: {
  liftsInbox?: boolean;
}) {
  return (
    // data-lifts-inbox: mientras llega el periodo, el botón de la bandeja no baja y vuelve a subir.
    <div
      aria-label="Cargando las facturas"
      data-lifts-inbox={liftsInbox ? "" : undefined}
      className="flex flex-1 flex-col"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-line px-5 py-3 md:px-6"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
