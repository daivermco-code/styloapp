"use server";

import { revalidatePath } from "next/cache";
import { bookingError } from "@/features/agenda/services/booking-errors";
import { firstIssue } from "@/features/business/services/owner";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/shared/types/database";
import {
  type ActionResult,
  actionFail,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import {
  ALREADY_REVIEWED,
  NOT_REVIEWABLE,
  type PunctualityInput,
  punctualitySchema,
  type ReviewInput,
  reviewSchema,
} from "../types/schemas";

/**
 * Marca si el cliente llegó (US-019). La base deja la cita efectiva o abandonada, recalcula la
 * reputación y, si quedó efectiva, deja la invitación a calificar. Solo desde que empezó: el
 * profesional sus citas, el dueño todas (RLS y `bookings_guard`).
 */
export async function markPunctuality(
  input: PunctualityInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = punctualitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ punctuality: parsed.data.punctuality })
    .eq("id", parsed.data.bookingId)
    .select("id")
    .maybeSingle();
  if (error)
    return { ok: false, error: bookingError(error, "markPunctuality") };
  if (!data) {
    return actionFail(AppErrorCode.NOT_FOUND, "Esta cita ya no existe.");
  }
  revalidatePath("/pro", "layout");
  return actionOk(data);
}

/**
 * Califica una cita (US-030). La RLS deja una reseña por cita propia ya empezada, no cancelada ni
 * marcada "no llegó"; `reviews_fill` pone el negocio, el profesional y el autor. Los promedios
 * salen de las vistas, así que cambian al momento.
 */
export async function submitReview(
  input: ReviewInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const { bookingId, attention, quality, comment } = parsed.data;
  // `business_id` y `staff_id` los pone `reviews_fill` (y solo se puede insertar estas cuatro
  // columnas); los tipos generados no lo saben.
  const row = {
    booking_id: bookingId,
    attention,
    quality,
    comment,
  } as TablesInsert<"reviews">;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .insert(row)
    .select("id")
    .single();
  if (error?.code === "23505") {
    return actionFail(AppErrorCode.VALIDATION_ERROR, ALREADY_REVIEWED);
  }
  if (error) {
    if (error.code !== "42501") console.error("[submitReview]", error.code);
    return actionFail(AppErrorCode.FORBIDDEN, NOT_REVIEWABLE);
  }
  revalidatePath("/app", "layout");
  return actionOk(data);
}
