import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { NOT_SAVED, SIGN_IN_AGAIN } from "@/features/business/services/owner";
import { type ActionError, AppErrorCode } from "@/shared/types/action-result";
import {
  ALREADY_INVOICED,
  INVOICE_GONE,
  MARK_BEFORE_INVOICING,
  INVOICE_PAID_OUT,
  INVOICE_VOIDED,
  NO_INVOICING_PERMISSION,
  NOT_OWN_INVOICE,
} from "../types/messages";

// Los errores de save_invoice y void_invoice (0004_dinero.sql) como los lee la persona
// (T-8.2.2 y T-8.3.2, US-040, US-041 y US-043). La base los manda en error.message y, en
// NOT_FOUND, dice en error.details qué faltó.

const KNOWN: Record<string, ActionError> = {
  NO_SESSION: { code: AppErrorCode.UNAUTHORIZED, message: SIGN_IN_AGAIN },
  NO_PERMISSION_INVOICING: {
    code: AppErrorCode.NO_PERMISSION_INVOICING,
    message: NO_INVOICING_PERMISSION,
  },
  NOT_OWN_ITEMS: {
    code: AppErrorCode.NO_PERMISSION_INVOICING,
    message: NOT_OWN_INVOICE,
  },
  INVOICE_VOID: { code: AppErrorCode.INVOICE_LOCKED, message: INVOICE_VOIDED },
  INVOICE_PAID_OUT: {
    code: AppErrorCode.INVOICE_LOCKED,
    message: INVOICE_PAID_OUT,
  },
  BOOKING_NOT_MARKED: {
    code: AppErrorCode.BOOKING_NOT_MARKED,
    message: MARK_BEFORE_INVOICING,
  },
  ALREADY_INVOICED: {
    code: AppErrorCode.ALREADY_INVOICED,
    message: ALREADY_INVOICED,
  },
  METHOD_INACTIVE: {
    code: AppErrorCode.METHOD_INACTIVE,
    message: "Ese método de pago está desactivado. Elige otro.",
  },
  ITEMS_COUNT: {
    code: AppErrorCode.VALIDATION_ERROR,
    message: "Agrega al menos un servicio. Máximo 20.",
    field: "items",
  },
  INVALID_ITEMS: {
    code: AppErrorCode.VALIDATION_ERROR,
    message: "Revisa los servicios y sus valores.",
    field: "items",
  },
};

// NOT_FOUND, por lo que dice error.details.
const NOT_FOUND: Record<string, string> = {
  invoice: INVOICE_GONE,
  booking: "Esta cita ya no existe.",
  client: "Ese cliente ya no existe. Elige otro.",
  method: "Ese método de pago ya no existe. Elige otro.",
  service: "Uno de los servicios ya no existe. Quítalo y vuelve a intentar.",
  staff: "Uno de los profesionales ya no está en el negocio.",
};

/** El error de save_invoice o void_invoice en palabras; lo que no se conoce, "No se guardaron…". */
export function invoiceError(
  error: PostgrestError,
  action: string,
): ActionError {
  if (error.message === "NOT_FOUND") {
    return {
      code: AppErrorCode.NOT_FOUND,
      message: NOT_FOUND[error.details] ?? NOT_SAVED,
    };
  }
  const known = KNOWN[error.message];
  if (known) return known;
  console.error(`[${action}]`, error.code);
  return { code: AppErrorCode.INTERNAL_ERROR, message: NOT_SAVED };
}
