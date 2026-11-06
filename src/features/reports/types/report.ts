// Los informes (Tech Spec O5.4). Los números vienen de las funciones report_* de la base
// (0005_reportes): pesos enteros, solo de las facturas pagadas y de los gastos del rango.

/** Del primer al último día que se mira, los dos incluidos; días "YYYY-MM-DD" de Bogotá. */
export interface ReportRange {
  from: string;
  to: string;
}

/** Una fila de report_summary. Gastos es null con un profesional elegido o si mira un profesional. */
export interface ReportSummary {
  services: number;
  /** En 0 hasta la oleada 6 (productos). */
  products: number;
  expenses: number | null;
  /** Las comisiones ganadas: el "Total comisiones" de Facturas. */
  commissions: number;
  invoices: number;
}

/** La variación contra el periodo anterior: 0 %, "Nuevo" o el cambio con su signo. */
export type Variation =
  { kind: "same" } | { kind: "new" } | { kind: "change"; pct: number };

/** Ventas: un servicio vendido en el rango. */
export interface ServiceReportRow {
  serviceId: string;
  name: string;
  times: number;
  total: number;
}

/** Comisiones: un profesional (sin el dueño). Ganado = pagado + pendiente. */
export interface CommissionReportRow {
  staffId: string;
  name: string;
  sold: number;
  earned: number;
  paid: number;
  pending: number;
}

/** Métodos de pago: los activos y los desactivados con ventas en el rango. */
export interface MethodReportRow {
  methodId: string;
  name: string;
  isActive: boolean;
  total: number;
  invoices: number;
}

/** Estadísticas (US-058): las tres tarjetas. */
export interface BusinessInsights {
  followers: number;
  /** Las reservas que hicieron los clientes, sin las canceladas. */
  clientBookings: number;
  visits: number;
}

/** Un seguidor del negocio: solo el nombre y desde cuándo sigue. */
export interface Follower {
  fullName: string;
  followedAt: string;
}
