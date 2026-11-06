// Liquidador e historial de pagos (US-045 y US-046, pantallas 12 y 13). Todo en pesos enteros.

/** Una tarjeta del liquidador: lo que se le debe a un profesional (sin el dueño). */
export interface PayrollRow {
  staffId: string;
  name: string;
  isActive: boolean;
  /** Suma de las comisiones de sus servicios en facturas pagadas que no se le han pagado. */
  pending: number;
  /** Cuántos servicios suman `pending`. */
  items: number;
  /** De cuántas facturas salen. */
  invoices: number;
  /** Sus citas que ya empezaron sin la llegada marcada: mientras haya, no se le paga. */
  unmarked: number;
  /** El día de la factura pendiente más vieja ("YYYY-MM-DD"), o null sin pendientes. */
  since: string | null;
}

/** Una cita sin la llegada marcada, para marcarla desde el liquidador. */
export interface UnmarkedBooking {
  id: string;
  startsAt: string;
  clientName: string;
  serviceName: string;
}

/** Un servicio de una factura pagada que todavía no entró en un pago al profesional. */
export interface PendingItem {
  id: string;
  invoiceId: string;
  invoiceNumber: number;
  /** "YYYY-MM-DD". */
  issuedOn: string;
  serviceName: string;
  price: number;
  commission: number;
}

/** El detalle de un profesional en el liquidador. */
export interface PayrollDetail {
  staffId: string;
  name: string;
  unmarked: UnmarkedBooking[];
  items: PendingItem[];
  /**
   * Lo pendiente según payroll() en la base: lo que sumará pay_staff. No se calcula sumando `items`
   * (la base corta las filas en 1.000, y las consultas corren a la vez).
   */
  total: number;
}

/** Una fila del historial de pagos. */
export interface PaymentListItem {
  id: string;
  staffName: string;
  amount: number;
  /** "YYYY-MM-DD". */
  paidOn: string;
  methodName: string;
}

/** El detalle de un pago: lo que cubrió. */
export interface PaymentDetail extends PaymentListItem {
  note: string | null;
  items: PendingItem[];
}
