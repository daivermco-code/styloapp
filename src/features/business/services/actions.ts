"use server";

import { revalidatePath } from "next/cache";
import {
  fitsWithin,
  OUTSIDE_BUSINESS,
  OUTSIDE_BUSINESS_SELF,
  type Weekday,
} from "@/features/agenda/lib/hours";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/shared/lib/phone";
import {
  type ActionResult,
  actionFail,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import {
  type BusinessFunctionsInput,
  businessFunctionsSchema,
  type BusinessProfileInput,
  businessProfileSchema,
  type WeekHoursInput,
  weekHoursSchema,
} from "../types/schemas";
import {
  firstIssue,
  NOT_SAVED,
  OWNER_ONLY,
  ownerBusinessId,
  SIGN_IN_AGAIN,
} from "./owner";
import { getWeekHours } from "./queries";

type Saved = ActionResult<{ saved: true }>;

/** Perfil del negocio (US-008). El enlace (slug) no cambia con el nombre. */
export async function updateBusinessProfile(
  input: BusinessProfileInput,
): Promise<Saved> {
  const parsed = businessProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const owner = await ownerBusinessId();
  if (!owner.ok) return { ok: false, error: owner.error };

  const { name, address, neighborhood, city, whatsapp } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      name,
      address,
      neighborhood: neighborhood || null,
      city,
      whatsapp: whatsapp ? normalizePhone(whatsapp) : null,
    })
    .eq("id", owner.businessId);
  if (error) {
    console.error("[updateBusinessProfile]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  revalidatePath("/", "layout");
  return actionOk({ saved: true });
}

/** Funciones adicionales (US-010). */
export async function updateBusinessFunctions(
  input: BusinessFunctionsInput,
): Promise<Saved> {
  const parsed = businessFunctionsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const owner = await ownerBusinessId();
  if (!owner.ok) return { ok: false, error: owner.error };

  const values = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      cancel_limit_minutes: values.cancelLimitMinutes,
      slot_interval_minutes: values.slotIntervalMinutes,
      online_booking: values.onlineBooking,
      show_owner_agenda: values.showOwnerAgenda,
      min_notice_minutes: values.minNoticeMinutes,
      max_advance_days: values.maxAdvanceDays,
    })
    .eq("id", owner.businessId);
  if (error) {
    console.error("[updateBusinessFunctions]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  revalidatePath("/", "layout");
  return actionOk({ saved: true });
}

/**
 * Guarda la semana entera del negocio (staffId null) o de un profesional (US-009, US-013 y
 * US-014). RLS decide quién puede: el dueño, todas las del negocio; el profesional, las suyas.
 * Sin transacción por la API: primero entran las franjas nuevas y luego salen las viejas; si
 * algo falla, se deshace lo hecho y la semana queda como estaba.
 */
export async function saveWeekHours(input: WeekHoursInput): Promise<Saved> {
  const parsed = weekHoursSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // El campo es el día (weekday) para que el editor marque ese día.
    const dayIndex = issue.path[1];
    const weekday =
      typeof dayIndex === "number" ? input.days[dayIndex]?.weekday : undefined;
    return actionFail(
      AppErrorCode.VALIDATION_ERROR,
      issue.message,
      String(weekday ?? ""),
    );
  }
  const person = await getCurrentPerson();
  if (!person) return actionFail(AppErrorCode.UNAUTHORIZED, SIGN_IN_AGAIN);
  if (!person.business) return actionFail(AppErrorCode.FORBIDDEN, OWNER_ONLY);

  const businessId = person.business.id;
  const { staffId, days } = parsed.data;
  if (staffId) {
    // El horario del profesional queda dentro del del negocio (US-013 y US-014).
    const business = await getWeekHours(businessId, null);
    const outside = days.find(
      (day) => !fitsWithin(day.ranges, business[day.weekday as Weekday]),
    );
    if (outside) {
      return actionFail(
        AppErrorCode.VALIDATION_ERROR,
        person.side === "owner" ? OUTSIDE_BUSINESS : OUTSIDE_BUSINESS_SELF,
        String(outside.weekday),
      );
    }
  }
  const supabase = await createClient();

  const current = supabase
    .from("work_hours")
    .select("id")
    .eq("business_id", businessId);
  const { data: old, error: readError } = await (staffId
    ? current.eq("staff_id", staffId)
    : current.is("staff_id", null));
  if (readError) {
    console.error("[saveWeekHours] read", readError.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }

  const rows = days.flatMap((day) =>
    day.ranges.map((range) => ({
      business_id: businessId,
      staff_id: staffId,
      weekday: day.weekday,
      starts: range.starts,
      ends: range.ends,
    })),
  );
  let insertedIds: string[] = [];
  if (rows.length > 0) {
    const { data: inserted, error } = await supabase
      .from("work_hours")
      .insert(rows)
      .select("id");
    if (error) {
      console.error("[saveWeekHours] insert", error.code);
      const forbidden = error.code === "42501";
      return actionFail(
        forbidden ? AppErrorCode.FORBIDDEN : AppErrorCode.INTERNAL_ERROR,
        forbidden ? "No puedes cambiar este horario." : NOT_SAVED,
      );
    }
    insertedIds = inserted.map((row) => row.id);
  }

  const oldIds = old.map((row) => row.id);
  if (oldIds.length > 0) {
    const { error } = await supabase
      .from("work_hours")
      .delete()
      .in("id", oldIds);
    if (error) {
      console.error("[saveWeekHours] delete", error.code);
      if (insertedIds.length > 0) {
        await supabase.from("work_hours").delete().in("id", insertedIds);
      }
      return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
    }
  }
  revalidatePath("/", "layout");
  return actionOk({ saved: true });
}
