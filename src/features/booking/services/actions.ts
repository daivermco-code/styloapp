"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { computeFreeHours } from "@/features/agenda/services/free-hours";
import { firstIssue, SIGN_IN_AGAIN } from "@/features/business/services/owner";
import { ONLINE_BOOKING_OFF } from "@/features/business/lib/functions";
import { createClient } from "@/lib/supabase/server";
import { bogotaDateTime } from "@/shared/lib/dates";
import {
  type ActionError,
  type ActionResult,
  actionFail,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import {
  type BookAsClientInput,
  BOOKING_GONE,
  bookAsClientSchema,
  type CancelAsClientInput,
  cancelAsClientSchema,
  CLIENT_BLOCKED_MESSAGE,
  CLIENT_SLOT_TAKEN,
  CLIENT_TOO_LATE,
  type ClientHoursInput,
  clientHoursSchema,
  OUT_OF_HOURS_MESSAGE,
  type RescheduleAsClientInput,
  rescheduleAsClientSchema,
  type RescheduleHoursInput,
  rescheduleHoursSchema,
  SERVICE_GONE,
} from "../types/schemas";
import { clientServiceMinutes, getMyBookings } from "./queries";

const NOT_BOOKED = "No se pudo reservar. Inténtalo de nuevo.";
const NOT_CHANGED = "No se pudo cambiar la cita. Inténtalo de nuevo.";

/**
 * Horas libres para el cliente (US-027): las del profesional ese día con la duración de la base y
 * las reglas de la reserva en línea del negocio. Funciona sin sesión (Explorar).
 */
export async function loadClientHours(
  input: ClientHoursInput,
): Promise<ActionResult<string[]>> {
  const parsed = clientHoursSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const { businessId, serviceId, staffId, day } = parsed.data;
  const minutes = await clientServiceMinutes(businessId, staffId, serviceId);
  if (minutes === null) return actionFail(AppErrorCode.NOT_FOUND, SERVICE_GONE);
  const hours = await computeFreeHours({
    businessId,
    staffId,
    day,
    durationMinutes: minutes,
    exceptId: null,
    online: true,
  });
  return actionOk(hours);
}

// Los errores de `client_book`, `client_reschedule` y `client_cancel` (0003_clientes) como los lee
// el cliente.
function clientBookingError(
  error: PostgrestError,
  fallback: string,
): ActionError {
  if (error.code === "23P01") {
    return { code: AppErrorCode.SLOT_TAKEN, message: CLIENT_SLOT_TAKEN };
  }
  switch (error.message) {
    case "CLIENT_BLOCKED":
      return {
        code: AppErrorCode.CLIENT_BLOCKED,
        message: CLIENT_BLOCKED_MESSAGE,
      };
    case "ONLINE_BOOKING_OFF":
      return { code: AppErrorCode.FORBIDDEN, message: ONLINE_BOOKING_OFF };
    case "OUT_OF_HOURS":
      return {
        code: AppErrorCode.OUTSIDE_HOURS,
        message: OUT_OF_HOURS_MESSAGE,
      };
    case "NOT_FOUND":
      return { code: AppErrorCode.NOT_FOUND, message: SERVICE_GONE };
    case "NO_SESSION":
      return { code: AppErrorCode.UNAUTHORIZED, message: SIGN_IN_AGAIN };
    case "TOO_LATE":
      return { code: AppErrorCode.CANCEL_TOO_LATE, message: CLIENT_TOO_LATE };
    case "BOOKING_LOCKED":
      return { code: AppErrorCode.BOOKING_LOCKED, message: BOOKING_GONE };
  }
  console.error("[clientBooking]", error.code);
  return { code: AppErrorCode.INTERNAL_ERROR, message: fallback };
}

/**
 * Reserva como cliente (US-027) con `client_book`, que revisa todas las reglas, crea o reutiliza
 * la ficha y calcula el fin y el precio. La cita sale en las agendas del negocio por Realtime.
 */
export async function bookAsClient(
  input: BookAsClientInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = bookAsClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const { serviceId, staffId, day, time, whatsappPromos } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_book", {
    p_service: serviceId,
    p_staff: staffId,
    p_starts_at: bogotaDateTime(day, time).toISOString(),
    p_promos: whatsappPromos,
  });
  if (error) return { ok: false, error: clientBookingError(error, NOT_BOOKED) };
  revalidatePath("/app", "layout");
  return actionOk({ id: data });
}

/**
 * Horas para cambiar una cita propia (US-029): las del mismo profesional y servicio, con la hora
 * de la cita libre. Solo de una cita del cliente que todavía está pendiente.
 */
export async function loadRescheduleHours(
  input: RescheduleHoursInput,
): Promise<ActionResult<string[]>> {
  const parsed = rescheduleHoursSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const { bookingId, day } = parsed.data;
  const [booking] = await getMyBookings(bookingId);
  if (!booking || booking.status !== "pending") {
    return actionFail(AppErrorCode.NOT_FOUND, BOOKING_GONE);
  }
  const minutes = await clientServiceMinutes(
    booking.business.id,
    booking.staffId,
    booking.serviceId,
  );
  if (minutes === null) return actionFail(AppErrorCode.NOT_FOUND, SERVICE_GONE);
  const hours = await computeFreeHours({
    businessId: booking.business.id,
    staffId: booking.staffId,
    day,
    durationMinutes: minutes,
    exceptId: booking.id,
    online: true,
  });
  return actionOk(hours);
}

/**
 * Cambiar la hora como cliente (US-029) con `client_reschedule`: las mismas reglas de la reserva
 * y el límite de cancelación del negocio. El negocio lo ve por Realtime y le llega el aviso.
 */
export async function rescheduleAsClient(
  input: RescheduleAsClientInput,
): Promise<ActionResult<null>> {
  const parsed = rescheduleAsClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const { bookingId, day, time } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_reschedule", {
    p_booking: bookingId,
    p_starts_at: bogotaDateTime(day, time).toISOString(),
  });
  if (error)
    return { ok: false, error: clientBookingError(error, NOT_CHANGED) };
  revalidatePath("/app", "layout");
  return actionOk(null);
}

/** Cancelar como cliente (US-029) con `client_cancel`, dentro del límite del negocio. */
export async function cancelAsClient(
  input: CancelAsClientInput,
): Promise<ActionResult<null>> {
  const parsed = cancelAsClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_cancel", {
    p_booking: parsed.data.bookingId,
  });
  if (error)
    return { ok: false, error: clientBookingError(error, NOT_CHANGED) };
  revalidatePath("/app", "layout");
  return actionOk(null);
}
