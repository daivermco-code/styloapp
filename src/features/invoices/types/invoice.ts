import type { DraftItem } from "../lib/draft";
import type { InvoicePayout } from "../lib/detail";
import type { InvoiceStatus } from "../lib/totals";

/** Quién mira Facturas: el dueño ve todo el negocio; el profesional, solo sus servicios. */
export interface InvoiceViewer {
  businessId: string;
  side: "owner" | "staff";
  /** Su fila en staff. */
  staffId: string;
  /** El dueño siempre; el profesional, con el permiso `invoicing` (se lee en cada visita). */
  canInvoice: boolean;
}

/** Una fila de la lista (US-042), con el valor y la comisión de lo que se mira. */
export interface InvoiceListItem {
  id: string;
  number: number;
  status: InvoiceStatus;
  issuedOn: string;
  /** La ficha, el nombre libre o "Sin cliente". */
  clientName: string;
  methodName: string;
  services: string[];
  value: number;
  commission: number;
}

/** Una persona de la fila de profesionales (solo el dueño). */
export interface InvoiceStaffOption {
  id: string;
  name: string;
}

/** Un servicio del detalle (US-043), con su profesional y la comisión que se copió al facturar. */
export interface InvoiceDetailLine {
  id: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  price: number;
  commissionPct: number;
  commission: number;
}

/** El detalle de una factura (T-8.2.2, US-043, pantalla 9), con lo que la RLS deja ver. */
export interface InvoiceDetail {
  id: string;
  number: number;
  status: InvoiceStatus;
  issuedOn: string;
  /** La ficha del cliente, si la tiene (el enlace sale solo para el dueño). */
  clientId: string | null;
  /** La ficha, el nombre libre o "Sin cliente". */
  clientName: string;
  /** La cita de la que salió, si quien mira la puede ver. */
  booking: { id: string; startsAt: string } | null;
  methodName: string;
  createdByName: string | null;
  voidedByName: string | null;
  voidedAt: string | null;
  lines: InvoiceDetailLine[];
  /** La suma de los servicios que se ven (al profesional, solo los suyos). */
  total: number;
  /** Los pagos al profesional en los que ya entró; vacío si ninguno. */
  payouts: InvoicePayout[];
  /** Si salen "Editar factura" y "Anular". */
  canChange: boolean;
}

/** Un método de pago del paso 3: los activos y, al editar, el que ya tenía la factura. */
export interface InvoiceMethodOption {
  id: string;
  name: string;
}

/** El cliente del borrador: una ficha, o sin cliente (con el nombre libre, si lo hay). */
export type DraftClient =
  { kind: "client"; id: string; fullName: string } | { kind: "guest" };

/**
 * Lo que trae el editor al abrir (T-8.3.1 y T-8.3.2): vacío al crear; la cita (US-041) o la
 * factura (US-043) ya puestas, que entran directo al paso 3.
 */
export interface InvoiceSeed {
  invoiceId: string | null;
  bookingId: string | null;
  /** El inicio de la cita, para "Sáb 31 oct · 11:00 a. m." en el resumen. */
  bookingStartsAt: string | null;
  client: DraftClient | null;
  guestName: string;
  items: DraftItem[];
  methodId: string | null;
}
