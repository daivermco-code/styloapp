import { parseDay } from "@/features/agenda/lib/grid";
import { type Period, parsePeriod } from "@/shared/lib/periods";
import type { InvoiceStatus } from "./totals";

// Lo que se mira en Facturas (T-8.2.1, US-042), todo en la URL para poder recargar y volver:
// ?periodo=&dia= (el periodo), ?pro= (el profesional, solo el dueño), ?filtro= y ?orden=.

export const INVOICE_FILTERS = ["pagadas", "anuladas"] as const;
export type InvoiceFilter = (typeof INVOICE_FILTERS)[number];

export const INVOICE_ORDERS = ["reciente", "lejana", "mayor", "menor"] as const;
export type InvoiceOrder = (typeof INVOICE_ORDERS)[number];

/** La hoja de filtrar: null es "Sin filtro". */
export const FILTER_OPTIONS: { value: InvoiceFilter | null; label: string }[] =
  [
    { value: "pagadas", label: "Pagadas" },
    { value: "anuladas", label: "Anuladas" },
    { value: null, label: "Sin filtro" },
  ];

export const ORDER_OPTIONS: { value: InvoiceOrder; label: string }[] = [
  { value: "reciente", label: "Más reciente" },
  { value: "lejana", label: "Más lejana" },
  { value: "mayor", label: "Valor más alto" },
  { value: "menor", label: "Valor más bajo" },
];

export interface InvoiceView {
  period: Period;
  day: string;
  /** El profesional elegido por el dueño; null es "Todos". */
  staffId: string | null;
  filter: InvoiceFilter | null;
  order: InvoiceOrder;
}

export interface InvoiceSearchParams {
  periodo?: string;
  dia?: string;
  pro?: string;
  filtro?: string;
  orden?: string;
}

/** Lo que dice la URL; lo que no se entiende queda en el valor de siempre (hoy, Día, Más reciente). */
export function parseInvoiceView(
  params: InvoiceSearchParams,
  today: string,
): InvoiceView {
  return {
    period: parsePeriod(params.periodo) ?? "dia",
    day: parseDay(params.dia) ?? today,
    staffId: params.pro || null,
    filter: INVOICE_FILTERS.find((value) => value === params.filtro) ?? null,
    order: INVOICE_ORDERS.find((value) => value === params.orden) ?? "reciente",
  };
}

/** La dirección de Facturas con lo que se mira y los cambios encima. */
export function invoicesHref(
  view: InvoiceView,
  changes: Partial<InvoiceView> = {},
): string {
  const next = { ...view, ...changes };
  const params = new URLSearchParams({ periodo: next.period, dia: next.day });
  if (next.staffId) params.set("pro", next.staffId);
  if (next.filter) params.set("filtro", next.filter);
  if (next.order !== "reciente") params.set("orden", next.order);
  return `/pro/facturas?${params}`;
}

export interface ArrangeableInvoice {
  number: number;
  issuedOn: string;
  status: InvoiceStatus;
  value: number;
}

function compare(order: InvoiceOrder) {
  return (a: ArrangeableInvoice, b: ArrangeableInvoice): number => {
    const byDay = a.issuedOn.localeCompare(b.issuedOn) || a.number - b.number;
    switch (order) {
      case "reciente":
        return -byDay;
      case "lejana":
        return byDay;
      case "mayor":
        return b.value - a.value || b.number - a.number;
      case "menor":
        return a.value - b.value || b.number - a.number;
    }
  };
}

/** Filtra (Pagadas, Anuladas o todas) y ordena la lista sin tocar la original. */
export function arrangeInvoices<T extends ArrangeableInvoice>(
  invoices: T[],
  filter: InvoiceFilter | null,
  order: InvoiceOrder,
): T[] {
  const status: InvoiceStatus | null =
    filter === "pagadas" ? "paid" : filter === "anuladas" ? "void" : null;
  return invoices
    .filter((invoice) => !status || invoice.status === status)
    .sort(compare(order));
}
