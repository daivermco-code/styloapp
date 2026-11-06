import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { NOT_SAVED } from "@/features/business/services/owner";
import { type ActionError, AppErrorCode } from "@/shared/types/action-result";
import {
  LOCKED_CANCELLED,
  LOCKED_CLIENT,
  LOCKED_NOT_STARTED,
  LOCKED_STARTED,
  NO_BOOKING_PERMISSION,
} from "../types/messages";
import { SLOT_TAKEN_MESSAGE } from "../types/schemas";

const EXCLUSION_VIOLATION = "23P01";
export const INSUFFICIENT_PRIVILEGE = "42501";

// Lo que `bookings_guard` no deja hacer (US-018 y US-019), por su detalle.
const LOCKED: Record<string, string> = {
  client: LOCKED_CLIENT,
  started: LOCKED_STARTED,
  cancelled: LOCKED_CANCELLED,
  not_started: LOCKED_NOT_STARTED,
};

/**
 * El error de la base como lo lee la persona: hora tomada, sin permiso o cita bloqueada. Va
 * aparte de los archivos "use server" para que lo usen la agenda y la llegada.
 */
export function bookingError(
  error: PostgrestError,
  action: string,
): ActionError {
  if (error.code === EXCLUSION_VIOLATION) {
    return { code: AppErrorCode.SLOT_TAKEN, message: SLOT_TAKEN_MESSAGE };
  }
  if (error.message === "BOOKING_LOCKED") {
    return {
      code: AppErrorCode.BOOKING_LOCKED,
      message: LOCKED[error.details] ?? NOT_SAVED,
    };
  }
  if (error.code === INSUFFICIENT_PRIVILEGE) {
    return {
      code: AppErrorCode.NO_PERMISSION_TEAM,
      message: NO_BOOKING_PERMISSION,
    };
  }
  console.error(`[${action}]`, error.code);
  return { code: AppErrorCode.INTERNAL_ERROR, message: NOT_SAVED };
}
