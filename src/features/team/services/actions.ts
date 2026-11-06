"use server";

import { revalidatePath } from "next/cache";
import { getCurrentPerson } from "@/features/auth/services/queries";
import {
  firstIssue,
  NOT_SAVED,
  ownerBusinessId,
  SIGN_IN_AGAIN,
} from "@/features/business/services/owner";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  actionFail,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import {
  type LinkStaffInput,
  linkStaffSchema,
  type StaffIdInput,
  staffIdSchema,
  type StaffPricingInput,
  staffPricingSchema,
  type StaffServicesInput,
  staffServicesSchema,
  type TeamPermissionsInput,
  teamPermissionsSchema,
} from "../types/schemas";

// Textos de US-012 para los errores de link_staff.
const CODE_NOT_FOUND = "No encontramos un negocio con ese código.";
const TEAM_FULL = "Este negocio ya completó su equipo.";
const NOT_YOURS = "Solo puedes cambiar tus propios servicios.";
const OWNER_PRICING =
  "Un servicio con precio o comisión que puso el dueño solo lo puede quitar el dueño. Pídeselo.";

/** Un profesional sin negocio entra al equipo con el código (US-012). */
export async function linkToBusiness(
  input: LinkStaffInput,
): Promise<ActionResult<{ businessName: string }>> {
  const parsed = linkStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const person = await getCurrentPerson();
  if (!person) return actionFail(AppErrorCode.UNAUTHORIZED, SIGN_IN_AGAIN);

  const supabase = await createClient();
  const { data: staffId, error } = await supabase.rpc("link_staff", {
    p_code: parsed.data.code,
    p_display_name: parsed.data.displayName,
  });
  if (error) {
    if (error.message === "LINK_CODE_NOT_FOUND") {
      return actionFail(AppErrorCode.INVALID_CODE, CODE_NOT_FOUND, "code");
    }
    if (error.message === "TEAM_FULL") {
      return actionFail(AppErrorCode.TEAM_FULL, TEAM_FULL, "code");
    }
    if (error.message === "ALREADY_LINKED") {
      return actionFail(
        AppErrorCode.FORBIDDEN,
        `Ya estás vinculado a ${error.details}.`,
      );
    }
    console.error("[linkToBusiness]", error.code);
    return actionFail(
      AppErrorCode.INTERNAL_ERROR,
      "No pudimos vincularte. Inténtalo de nuevo.",
    );
  }

  const { data: member } = await supabase
    .from("staff")
    .select("business:businesses(name)")
    .eq("id", staffId)
    .maybeSingle();
  revalidatePath("/", "layout");
  return actionOk({ businessName: member?.business?.name ?? "tu negocio" });
}

/**
 * El dueño desactiva a un profesional (US-012): deja de salir para reservas nuevas y lo hecho
 * se conserva. Para volver, el profesional escribe de nuevo el código. El dueño no se desactiva.
 */
export async function deactivateStaff(
  input: StaffIdInput,
): Promise<ActionResult<{ displayName: string }>> {
  const parsed = staffIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const owner = await ownerBusinessId();
  if (!owner.ok) return { ok: false, error: owner.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .update({ is_active: false })
    .eq("id", parsed.data.staffId)
    .eq("business_id", owner.businessId)
    .eq("role", "staff")
    .eq("is_active", true)
    .select("display_name")
    .maybeSingle();
  if (error) {
    console.error("[deactivateStaff]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  if (!data) {
    return actionFail(
      AppErrorCode.NOT_FOUND,
      "Ese profesional ya no está activo en tu equipo.",
    );
  }
  revalidatePath("/", "layout");
  return actionOk({ displayName: data.display_name });
}

/**
 * Los servicios que hace un profesional y su duración con él (US-013 y US-014). Lo cambia el
 * dueño o el mismo profesional; staff_services_guard no deja que el profesional toque precio ni
 * comisión, ni quitar un servicio que los tenga (staff_services_delete_guard). Primero se guardan
 * los marcados y luego salen los desmarcados; los servicios archivados no se tocan.
 */
export async function saveStaffServices(
  input: StaffServicesInput,
): Promise<ActionResult<{ saved: true }>> {
  const parsed = staffServicesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const person = await getCurrentPerson();
  if (!person) return actionFail(AppErrorCode.UNAUTHORIZED, SIGN_IN_AGAIN);
  if (!person.business) return actionFail(AppErrorCode.FORBIDDEN, NOT_YOURS);

  const { staffId, services } = parsed.data;
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("staff")
    .select("profile_id")
    .eq("id", staffId)
    .eq("business_id", person.business.id)
    .maybeSingle();
  if (!member || (person.side !== "owner" && member.profile_id !== person.id)) {
    return actionFail(AppErrorCode.FORBIDDEN, NOT_YOURS);
  }

  if (services.length > 0) {
    const { error } = await supabase.from("staff_services").upsert(
      services.map((service) => ({
        staff_id: staffId,
        service_id: service.serviceId,
        duration_minutes: service.durationMinutes,
      })),
      { onConflict: "staff_id,service_id" },
    );
    if (error) {
      console.error("[saveStaffServices] upsert", error.code);
      return actionFail(
        error.code === "42501"
          ? AppErrorCode.FORBIDDEN
          : AppErrorCode.INTERNAL_ERROR,
        error.code === "42501" ? NOT_YOURS : NOT_SAVED,
      );
    }
  }

  const { data: current, error: readError } = await supabase
    .from("staff_services")
    .select("service_id, services!inner(is_active)")
    .eq("staff_id", staffId)
    .eq("services.is_active", true);
  if (readError) {
    console.error("[saveStaffServices] read", readError.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  const chosen = new Set(services.map((service) => service.serviceId));
  const removed = current
    .map((row) => row.service_id)
    .filter((serviceId) => !chosen.has(serviceId));
  if (removed.length > 0) {
    const { error } = await supabase
      .from("staff_services")
      .delete()
      .eq("staff_id", staffId)
      .in("service_id", removed);
    if (error) {
      if (error.message === "OWNER_PRICING") {
        return actionFail(AppErrorCode.FORBIDDEN, OWNER_PRICING);
      }
      console.error("[saveStaffServices] delete", error.code);
      return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
    }
  }
  revalidatePath("/", "layout");
  return actionOk({ saved: true });
}

/**
 * El dueño pone el precio y la comisión de cada servicio con un profesional (US-037). Solo se
 * cambian los servicios que ese profesional ya hace; el precio vacío vuelve al general.
 */
export async function saveStaffPricing(
  input: StaffPricingInput,
): Promise<ActionResult<{ saved: true }>> {
  const parsed = staffPricingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const owner = await ownerBusinessId();
  if (!owner.ok) return { ok: false, error: owner.error };

  const { staffId, rows } = parsed.data;
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("staff")
    .select("id")
    .eq("id", staffId)
    .eq("business_id", owner.businessId)
    .maybeSingle();
  if (!member) {
    return actionFail(
      AppErrorCode.NOT_FOUND,
      "Ese profesional ya no está en tu equipo.",
    );
  }

  const results = await Promise.all(
    rows.map((row) =>
      supabase
        .from("staff_services")
        .update({ price: row.price, commission_pct: row.commissionPct })
        .eq("staff_id", staffId)
        .eq("service_id", row.serviceId),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    console.error("[saveStaffPricing]", failed.error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  revalidatePath("/", "layout");
  return actionOk({ saved: true });
}

/**
 * Los 5 permisos de todo el equipo (US-038). Valen al momento: la agenda y la caja los leen en
 * cada pantalla.
 */
export async function saveTeamPermissions(
  input: TeamPermissionsInput,
): Promise<ActionResult<{ saved: true }>> {
  const parsed = teamPermissionsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const owner = await ownerBusinessId();
  if (!owner.ok) return { ok: false, error: owner.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_permissions")
    .update({
      internal_clients: parsed.data.internalClients,
      invoicing: parsed.data.invoicing,
      manual_booking: parsed.data.manualBooking,
      manual_block: parsed.data.manualBlock,
      see_client_phone: parsed.data.seeClientPhone,
    })
    .eq("business_id", owner.businessId)
    .select("business_id")
    .maybeSingle();
  if (error || !data) {
    console.error("[saveTeamPermissions]", error?.code ?? "sin fila");
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  revalidatePath("/", "layout");
  return actionOk({ saved: true });
}
