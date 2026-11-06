"use server";

import { revalidatePath } from "next/cache";
import { getCurrentPerson } from "@/features/auth/services/queries";
import {
  firstIssue,
  NOT_SAVED,
  SIGN_IN_AGAIN,
} from "@/features/business/services/owner";
import { createClient } from "@/lib/supabase/server";
import { bogotaDateTime } from "@/shared/lib/dates";
import {
  type ActionError,
  type ActionResult,
  actionFail,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import { bookingEnd } from "../lib/slots";
import type { AgendaClient, AgendaViewer } from "../types/agenda";
import { NO_BOOKING_PERMISSION } from "../types/messages";
import {
  type BookingNoteInput,
  bookingNoteSchema,
  type CancelBookingInput,
  cancelBookingSchema,
  type CreateBookingInput,
  createBookingSchema,
  type FreeHoursInput,
  freeHoursSchema,
  type QuickClientInput,
  quickClientSchema,
  SLOT_TAKEN_MESSAGE,
  type UpdateBookingInput,
  updateBookingSchema,
} from "../types/schemas";
import { bookingError, INSUFFICIENT_PRIVILEGE } from "./booking-errors";
import { computeFreeHours, servicePriceFor } from "./free-hours";
import { getAgendaViewer } from "./queries";

const NOT_THEIR_SERVICE = "Este profesional no hace este servicio. Elige otro.";
const NO_CLIENT_PERMISSION =
  "Tu negocio no te ha dado permiso para crear clientes. Pídeselo al dueño.";
type ViewerResult =
  { ok: true; viewer: AgendaViewer } | { ok: false; error: ActionError };

/** Quien agenda: con sesión, del negocio y con permiso; el profesional, solo en su columna. */
async function bookingViewer(staffId: string): Promise<ViewerResult> {
  const person = await getCurrentPerson();
  const viewer = person ? await getAgendaViewer(person) : null;
  if (!viewer) {
    return {
      ok: false,
      error: { code: AppErrorCode.UNAUTHORIZED, message: SIGN_IN_AGAIN },
    };
  }
  if (
    !viewer.canBook ||
    (viewer.side === "staff" && staffId !== viewer.staffId)
  ) {
    return {
      ok: false,
      error: {
        code: AppErrorCode.NO_PERMISSION_TEAM,
        message: NO_BOOKING_PERMISSION,
      },
    };
  }
  return { ok: true, viewer };
}

/** La fila de horas del editor (US-017): las horas libres para ese profesional, día y duración. */
export async function loadFreeHours(
  input: FreeHoursInput,
): Promise<ActionResult<string[]>> {
  const parsed = freeHoursSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const access = await bookingViewer(parsed.data.staffId);
  if (!access.ok) return { ok: false, error: access.error };
  return actionOk(
    await computeFreeHours({
      businessId: access.viewer.businessId,
      ...parsed.data,
    }),
  );
}

interface BookingTimes {
  businessId: string;
  staffId: string;
  serviceId: string;
  day: string;
  time: string;
  durationMinutes: number;
  exceptId: string | null;
}

/**
 * Lo que se revisa antes de guardar, otra vez en el servidor: que el profesional haga el servicio
 * (y su precio) y que la hora siga libre. La exclusión de la base es la última palabra.
 */
async function checkBooking(
  times: BookingTimes,
): Promise<
  | { ok: true; price: number; startsAt: string; endsAt: string }
  | { ok: false; error: ActionError }
> {
  const price = await servicePriceFor(
    times.businessId,
    times.staffId,
    times.serviceId,
  );
  if (price === null) {
    return {
      ok: false,
      error: {
        code: AppErrorCode.VALIDATION_ERROR,
        message: NOT_THEIR_SERVICE,
        field: "staffId",
      },
    };
  }
  const free = await computeFreeHours(times);
  if (!free.includes(times.time)) {
    return {
      ok: false,
      error: { code: AppErrorCode.SLOT_TAKEN, message: SLOT_TAKEN_MESSAGE },
    };
  }
  const startsAt = bogotaDateTime(times.day, times.time).toISOString();
  return {
    ok: true,
    price,
    startsAt,
    endsAt: bookingEnd(startsAt, times.durationMinutes),
  };
}

/** Crea una cita desde la agenda (US-017). Queda reservada por el negocio. */
export async function createBooking(
  input: CreateBookingInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const values = parsed.data;
  const access = await bookingViewer(values.staffId);
  if (!access.ok) return { ok: false, error: access.error };
  const businessId = access.viewer.businessId;
  const check = await checkBooking({ ...values, businessId, exceptId: null });
  if (!check.ok) return { ok: false, error: check.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      business_id: businessId,
      staff_id: values.staffId,
      service_id: values.serviceId,
      client_id: values.clientId,
      guest_name: values.clientId ? null : values.guestName,
      starts_at: check.startsAt,
      ends_at: check.endsAt,
      price: check.price,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: bookingError(error, "createBooking") };
  revalidatePath("/pro", "layout");
  return actionOk(data);
}

/** Cambia profesional, servicio, día, hora o duración de una cita (US-018). */
export async function updateBooking(
  input: UpdateBookingInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const values = parsed.data;
  const access = await bookingViewer(values.staffId);
  if (!access.ok) return { ok: false, error: access.error };
  const check = await checkBooking({
    ...values,
    businessId: access.viewer.businessId,
    exceptId: values.bookingId,
  });
  if (!check.ok) return { ok: false, error: check.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({
      staff_id: values.staffId,
      service_id: values.serviceId,
      starts_at: check.startsAt,
      ends_at: check.endsAt,
      price: check.price,
      ...(values.guestName ? { guest_name: values.guestName } : {}),
    })
    .eq("id", values.bookingId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: bookingError(error, "updateBooking") };
  if (!data) {
    return actionFail(AppErrorCode.NOT_FOUND, "Esta cita ya no existe.");
  }
  revalidatePath("/pro", "layout");
  return actionOk(data);
}

/** "Crear cliente" rápido del editor (US-017): nombre y, si se sabe, el celular. */
export async function createQuickClient(
  input: QuickClientInput,
): Promise<ActionResult<AgendaClient>> {
  const parsed = quickClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const person = await getCurrentPerson();
  const viewer = person ? await getAgendaViewer(person) : null;
  if (!viewer) return actionFail(AppErrorCode.UNAUTHORIZED, SIGN_IN_AGAIN);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      business_id: viewer.businessId,
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
    })
    .select("id, full_name")
    .single();
  if (error) {
    if (error.code === INSUFFICIENT_PRIVILEGE) {
      return actionFail(AppErrorCode.NO_PERMISSION_TEAM, NO_CLIENT_PERMISSION);
    }
    console.error("[createQuickClient]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  return actionOk({
    id: data.id,
    fullName: data.full_name,
    phone: parsed.data.phone,
    hasAccount: false,
    isBlocked: false,
  });
}

/**
 * Cancela una cita (US-018). Si es de una serie y se pide, también las siguientes que siguen
 * pendientes (US-022). La base avisa al cliente y al profesional por cada una.
 */
export async function cancelBooking(
  input: CancelBookingInput,
): Promise<ActionResult<{ cancelled: number }>> {
  const parsed = cancelBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const person = await getCurrentPerson();
  const viewer = person ? await getAgendaViewer(person) : null;
  if (!viewer) return actionFail(AppErrorCode.UNAUTHORIZED, SIGN_IN_AGAIN);
  if (!viewer.canBook) {
    return actionFail(AppErrorCode.NO_PERMISSION_TEAM, NO_BOOKING_PERMISSION);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.bookingId)
    .select("recurring_id, starts_at")
    .maybeSingle();
  if (error) return { ok: false, error: bookingError(error, "cancelBooking") };
  if (!data) {
    return actionFail(AppErrorCode.NOT_FOUND, "Esta cita ya no existe.");
  }
  let cancelled = 1;
  if (parsed.data.scope === "following" && data.recurring_id) {
    const { data: following, error: followingError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("recurring_id", data.recurring_id)
      .eq("status", "pending")
      .gt("starts_at", data.starts_at)
      .select("id");
    if (followingError) {
      return {
        ok: false,
        error: bookingError(followingError, "cancelBooking"),
      };
    }
    cancelled += following.length;
  }
  revalidatePath("/pro", "layout");
  return actionOk({ cancelled });
}

/** Crea o cambia la nota de la cita (US-018, hasta 500 caracteres). Vacía, la quita. */
export async function saveBookingNote(
  input: BookingNoteInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = bookingNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ note: parsed.data.note === "" ? null : parsed.data.note })
    .eq("id", parsed.data.bookingId)
    .select("id")
    .maybeSingle();
  if (error)
    return { ok: false, error: bookingError(error, "saveBookingNote") };
  if (!data) {
    return actionFail(AppErrorCode.NOT_FOUND, "Esta cita ya no existe.");
  }
  revalidatePath("/pro", "layout");
  return actionOk(data);
}
