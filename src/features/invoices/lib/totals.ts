// Cuentas de la lista de facturas (T-8.2.1, US-042). Son puras para probarlas sin la base.

export type InvoiceStatus = "paid" | "void";

/** Un servicio vendido, como lo deja leer la RLS (el profesional, solo los suyos). */
export interface InvoiceLine {
  staffId: string;
  serviceName: string;
  price: number;
  /** La comisión que se copió al facturar (columna generada de invoice_items). */
  commission: number;
}

/** Lo que suma una factura dentro de lo que se mira: valor, comisión y servicios. */
export interface LinesSummary {
  value: number;
  commission: number;
  services: string[];
}

/**
 * Suma los servicios de una factura que caen en lo que se mira: todos, o solo los de un
 * profesional (el dueño que elige uno, o el profesional, que ya solo ve los suyos).
 */
export function summarizeLines(
  lines: InvoiceLine[],
  staffId: string | null,
): LinesSummary {
  const inScope = staffId
    ? lines.filter((line) => line.staffId === staffId)
    : lines;
  return {
    value: inScope.reduce((sum, line) => sum + line.price, 0),
    commission: inScope.reduce((sum, line) => sum + line.commission, 0),
    services: inScope.map((line) => line.serviceName),
  };
}

export interface PeriodTotals {
  sales: number;
  commissions: number;
}

/** "Total ventas" y "Total comisiones" del periodo: las anuladas no cuentan. */
export function periodTotals(
  invoices: { status: InvoiceStatus; value: number; commission: number }[],
): PeriodTotals {
  return invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce(
      (totals, invoice) => ({
        sales: totals.sales + invoice.value,
        commissions: totals.commissions + invoice.commission,
      }),
      { sales: 0, commissions: 0 },
    );
}

/** El número con cuatro cifras: 12 → "Factura 0012". */
export function invoiceTitle(invoiceNumber: number): string {
  return `Factura ${String(invoiceNumber).padStart(4, "0")}`;
}
