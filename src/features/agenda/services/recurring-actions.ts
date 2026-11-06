"use server";

import { revalidatePath } from "next/cache";
import { getCurrentPerson } from "@/features/auth/services/queries";
import {
  firstIssue,
  NOT_SAVED,
  SIGN_IN_AGAIN,
} from "@/features/business/services/owner";
import { createClient } from "@/lib/supabase/server";
import { bogotaDateTime, weekdayOf } from "@/shared/lib/dates";
import {
  type ActionError,
  type ActionResult,
  actionFail,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import { recurringDates, seriesSummary } from "../lib/recurring";
import { bookingEnd } from "../lib/slots";
import type { AgendaViewer, SeriesDate } from "../types/agenda";
import { NO_SERIES_PERMISSION } from "../types/messages";
import {
  type CreateSeriesInput,
  createSeriesSchema,
  type DeleteSeriesInput,
  deleteSeriesSchema,
  type SeriesPreviewInput,
  seriesPreviewSchema,
} from "../types/schemas";
import { bookingError } from "./booking-errors";
import { servicePriceFor } from "./free-hours";
import { getAgendaViewer } from "./queries";
import { classifySeries } from "./series";

const EXCLUSION_VIOLATION = "23P01";
const NOT_THEIR_SERVICE = "Este profesional no hace este servicio. Elige otro.";

type OwnerResult =
  { ok: true; viewer: AgendaViewer } | { ok: false; error: ActionError };

/** Solo el dueño crea series (US-022); la base lo repite (RLS y bookings_guard). */
async function seriesOwner(): Promise<OwnerResult> {
  const person = await getCurrentPerson();
  const viewer = person ? await getAgendaViewer(person) : null;
  if (!viewer) {
    return {
      ok: false,
      error: { code: AppErrorCode.UNAUTHORIZED, message: SIGN_IN_AGAIN },
    };
  }
  if (viewer.side !== "owner") {
    return {
      ok: false,
      error: {
        code: AppErrorCode.NO_PERMISSION_TEAM,
        message: NO_SERIES_PERMISSION,
      },
    };
  }
  return { ok: true, viewer };
}

/** La lista de fechas de "Repetir esta cita", marcando las que no se pueden crear. */
export async function previewRecurring(
  input: SeriesPreviewInput,
): Promise<ActionResult<SeriesDate[]>> {
  const parsed = seriesPreviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const access = await seriesOwner();
  if (!access.ok) return { ok: false, error: access.error };
  const values = parsed.data;
  return actionOk(
    await classifySeries({
      businessId: access.viewer.businessId,
      staffId: values.staffId,
      dates: recurringDates(values.day, values.frequency, values.count),
      time: values.time,
      durationMinutes: values.durationMinutes,
    }),
  );
}

interface NewSeries {
  businessId: string;
  values: CreateSeriesInput;
  price: number;
  /** Las fechas libres de la serie. */
  days: string[];
}

type SavedSeries =
  | { ok: true; created: number; taken: number }
  | { ok: false; error: ActionError };

/**
 * Crea las citas libres de la serie una por una: cada una pasa por la exclusión de la base y, si
 * alguien tomó la hora mientras tanto, cuenta como ocupada y las demás siguen. Null si la base
 * falla por otra cosa.
 */
async function insertSeriesBookings(
  seriesId: string,
  { businessId, values, price, days }: NewSeries,
): Promise<{ created: number; taken: number } | null> {
  const supabase = await createClient();
  let created = 0;
  let taken = 0;
  for (const day of days) {
    const startsAt = bogotaDateTime(day, values.time).toISOString();
    const { error } = await supabase.from("bookings").insert({
      business_id: businessId,
      staff_id: values.staffId,
      service_id: values.serviceId,
      client_id: values.clientId,
      starts_at: startsAt,
      ends_at: bookingEnd(startsAt, values.durationMinutes),
      price,
      recurring_id: seriesId,
    });
    if (!error) created++;
    else if (error.code === EXCLUSION_VIOLATION) taken++;
    else {
      console.error("[createRecurring]", error.code);
      return null;
    }
  }
  return { created, taken };
}

/** Guarda la serie y sus citas; si no queda ninguna cita (o la base falla), la serie se borra. */
async function saveSeries(series: NewSeries): Promise<SavedSeries> {
  const { businessId, values } = series;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_bookings")
    .insert({
      business_id: businessId,
      staff_id: values.staffId,
      service_id: values.serviceId,
      client_id: values.clientId,
      weekday: weekdayOf(values.day),
      start_time: values.time,
      frequency: values.frequency,
      starts_on: values.day,
      occurrences: values.count,
    })
    .select("id")
    .single();
  if (error)
    return { ok: false, error: bookingError(error, "createRecurring") };

  const result = await insertSeriesBookings(data.id, series);
  if (!result || result.created === 0) {
    await supabase.from("recurring_bookings").delete().eq("id", data.id);
  }
  if (!result) {
    return {
      ok: false,
      error: { code: AppErrorCode.INTERNAL_ERROR, message: NOT_SAVED },
    };
  }
  return { ok: true, ...result };
}

/** Crea la serie (US-022): las citas libres ligadas a ella, y dice cuáles no se pudieron. */
export async function createRecurring(
  input: CreateSeriesInput,
): Promise<ActionResult<{ created: number; message: string }>> {
  const parsed = createSeriesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const access = await seriesOwner();
  if (!access.ok) return { ok: false, error: access.error };
  const values = parsed.data;
  const businessId = access.viewer.businessId;
  const price = await servicePriceFor(
    businessId,
    values.staffId,
    values.serviceId,
  );
  if (price === null) {
    return actionFail(AppErrorCode.VALIDATION_ERROR, NOT_THEIR_SERVICE);
  }
  const dates = await classifySeries({
    businessId,
    staffId: values.staffId,
    dates: recurringDates(values.day, values.frequency, values.count),
    time: values.time,
    durationMinutes: values.durationMinutes,
  });
  const count = (status: SeriesDate["status"]) =>
    dates.filter((item) => item.status === status).length;
  const saved = await saveSeries({
    businessId,
    values,
    price,
    days: dates
      .filter((item) => item.status === "free")
      .map((item) => item.day),
  });
  if (!saved.ok) return { ok: false, error: saved.error };
  revalidatePath("/pro", "layout");
  // Fuera de horario y las fechas que ya pasaron cuentan juntas: no se pueden crear.
  const message = seriesSummary(
    saved.created,
    count("busy") + saved.taken,
    count("closed") + count("past"),
  );
  return actionOk({ created: saved.created, message });
}

const SERIES_GONE = "Esta serie ya no existe.";

/**
 * "Eliminar serie" (T-10.2.2, US-050): cancela las citas pendientes que todavía no empiezan (la
 * base avisa al cliente y al profesional por cada una) y borra la serie. Las que ya pasaron se
 * quedan, sin serie (recurring_id queda en null). Solo el dueño.
 */
export async function deleteSeries(
  input: DeleteSeriesInput,
): Promise<ActionResult<{ cancelled: number }>> {
  const parsed = deleteSeriesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const access = await seriesOwner();
  if (!access.ok) return { ok: false, error: access.error };
  const { businessId } = access.viewer;
  const { recurringId } = parsed.data;

  const supabase = await createClient();
  // Primero cancelar: al borrar la serie, sus citas pierden el enlace.
  const { data: cancelled, error: cancelError } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("business_id", businessId)
    .eq("recurring_id", recurringId)
    .eq("status", "pending")
    .gt("starts_at", new Date().toISOString())
    .select("id");
  if (cancelError) {
    return { ok: false, error: bookingError(cancelError, "deleteSeries") };
  }
  const { data: deleted, error } = await supabase
    .from("recurring_bookings")
    .delete()
    .eq("business_id", businessId)
    .eq("id", recurringId)
    .select("id");
  if (error) {
    console.error("[deleteSeries]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  revalidatePath("/pro", "layout");
  if (!deleted?.length) return actionFail(AppErrorCode.NOT_FOUND, SERIES_GONE);
  return actionOk({ cancelled: cancelled.length });
}
