import {
  formatDayMonth,
  formatShortDate,
  formatTime,
} from "@/shared/lib/dates";
import { INVOICE_PAID_OUT } from "../types/messages";
import type { InvoiceStatus } from "./totals";

// Reglas del detalle de una factura (T-8.2.2, US-043, pantalla 9). Son puras para probarlas sin
// la base.

/** Un servicio de la factura con su pago al profesional, si ya entró en uno. */
export interface PayoutSource {
  staffPaymentId: string | null;
  /** El profesional del servicio. */
  staffName: string;
  /** El pago, si la RLS lo deja leer (solo el dueño lee staff_payments). */
  payment: { paidOn: string; staffName: string } | null;
}

/** Un pago al profesional en el que entró la factura. */
export interface InvoicePayout {
  key: string;
  staffName: string;
  /** Día del pago ("YYYY-MM-DD"); null si quien mira no lo puede leer (el profesional). */
  paidOn: string | null;
}

/** Los pagos en los que entró la factura, uno por pago aunque cubra varios servicios. */
export function invoicePayouts(items: PayoutSource[]): InvoicePayout[] {
  const payouts = new Map<string, InvoicePayout>();
  for (const item of items) {
    if (!item.staffPaymentId || payouts.has(item.staffPaymentId)) continue;
    payouts.set(item.staffPaymentId, {
      key: item.staffPaymentId,
      staffName: item.payment?.staffName ?? item.staffName,
      paidOn: item.payment?.paidOn ?? null,
    });
  }
  return [...payouts.values()];
}

/** "Pagada a Camilo el 1 nov"; sin el día (el profesional no lo lee), el aviso de US-043. */
export function payoutText(payout: InvoicePayout): string {
  if (!payout.paidOn) return INVOICE_PAID_OUT;
  return `Pagada a ${payout.staffName} el ${formatDayMonth(`${payout.paidOn}T12:00:00-05:00`)}`;
}

/** "Anulada por Camilo el 1 nov", con lo que se sepa; sin ningún dato, null. */
export function voidedText(
  voidedBy: string | null,
  voidedAt: string | null,
): string | null {
  if (!voidedBy && !voidedAt) return null;
  const by = voidedBy ? ` por ${voidedBy}` : "";
  const when = voidedAt ? ` el ${formatDayMonth(voidedAt)}` : "";
  return `Anulada${by}${when}`;
}

/** "comisión 50 %", con coma decimal si hace falta ("comisión 37,5 %"). */
export function commissionLabel(pct: number): string {
  const value = pct.toLocaleString("es-CO", { maximumFractionDigits: 2 });
  return `comisión ${value} %`;
}

/** Quién mira, para decidir si salen Editar y Anular. */
export interface ChangeViewer {
  side: "owner" | "staff";
  staffId: string;
  canInvoice: boolean;
}

/** Lo que importa de la factura para Editar y Anular. */
export interface ChangeTarget {
  status: InvoiceStatus;
  /** Algún servicio ya entró en un pago al profesional. */
  paidOut: boolean;
  /**
   * Todos los servicios de la factura son de quien mira (invoice_all_mine). Lo dice la base: al
   * profesional la RLS le esconde los de otros, y uno ajeno de $ 0 ni cambia la suma.
   */
  allMine: boolean;
}

/**
 * Si salen "Editar factura" y "Anular" (US-043): nunca en una anulada ni en una que ya entró en
 * un pago. El dueño siempre; el profesional, con el permiso y todos los servicios a su nombre.
 * void_invoice y save_invoice lo vuelven a revisar en la base.
 */
export function canChangeInvoice(
  viewer: ChangeViewer,
  target: ChangeTarget,
): boolean {
  if (target.status === "void" || target.paidOut) return false;
  if (viewer.side === "owner") return true;
  return viewer.canInvoice && target.allMine;
}

/** La cita de la factura: "Sáb 31 oct · 11:00 a. m." (detalle y paso 3 del editor). */
export function bookingLabel(startsAt: string): string {
  const day = formatShortDate(startsAt);
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${formatTime(startsAt)}`;
}
