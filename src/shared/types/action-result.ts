// Lo que devuelve cada Server Action (Tech Spec §5.1 y §9.1).

export enum AppErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  SLOT_TAKEN = "SLOT_TAKEN", // choca con otra cita (restricción de exclusión)
  OUTSIDE_HOURS = "OUTSIDE_HOURS",
  CLIENT_BLOCKED = "CLIENT_BLOCKED",
  CANCEL_TOO_LATE = "CANCEL_TOO_LATE",
  NO_PERMISSION_TEAM = "NO_PERMISSION_TEAM", // el negocio no dio el permiso
  BOOKING_LOCKED = "BOOKING_LOCKED", // creada por el cliente o ya empezó
  INVALID_CODE = "INVALID_CODE",
  TEAM_FULL = "TEAM_FULL",
  DUPLICATE_NAME = "DUPLICATE_NAME", // ya hay uno con ese nombre en el negocio
  LAST_ACTIVE = "LAST_ACTIVE", // dejaría el negocio sin ningún método de pago activo
  IN_USE = "IN_USE", // ya está en facturas o gastos: se desactiva en vez de borrarlo
  NO_PERMISSION_INVOICING = "NO_PERMISSION_INVOICING", // sin el permiso de facturar, o servicios de otro
  INVOICE_LOCKED = "INVOICE_LOCKED", // anulada o ya entró en un pago al profesional
  ALREADY_INVOICED = "ALREADY_INVOICED", // la cita ya tiene una factura pagada
  BOOKING_NOT_MARKED = "BOOKING_NOT_MARKED", // la cita no tiene la llegada marcada
  METHOD_INACTIVE = "METHOD_INACTIVE", // el método de pago está desactivado
  UNMARKED_BOOKINGS = "UNMARKED_BOOKINGS", // el profesional tiene citas pasadas sin la llegada marcada
  NOTHING_PENDING = "NOTHING_PENDING", // el profesional no tiene comisiones pendientes
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export interface ActionError {
  code: AppErrorCode;
  message: string;
  field?: string;
}

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: ActionError };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFail<T = never>(
  code: AppErrorCode,
  message: string,
  field?: string,
): ActionResult<T> {
  return { ok: false, error: { code, message, field } };
}
