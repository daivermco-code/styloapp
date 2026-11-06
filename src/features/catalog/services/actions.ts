"use server";

import { revalidatePath } from "next/cache";
import {
  firstIssue,
  NOT_SAVED,
  ownerBusinessId,
} from "@/features/business/services/owner";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  actionFail,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import type { Category } from "../types/catalog";
import {
  type CategoryInput,
  categorySchema,
  type ServiceInput,
  serviceSchema,
  serviceStateSchema,
} from "../types/schemas";

const UNIQUE_VIOLATION = "23505";

/** Nueva categoría desde el editor de servicio (US-011). Queda de última. */
export async function createCategory(
  input: CategoryInput,
): Promise<ActionResult<Category>> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const owner = await ownerBusinessId();
  if (!owner.ok) return { ok: false, error: owner.error };

  const supabase = await createClient();
  const { count } = await supabase
    .from("service_categories")
    .select("id", { count: "exact", head: true })
    .eq("business_id", owner.businessId);
  const { data, error } = await supabase
    .from("service_categories")
    .insert({
      business_id: owner.businessId,
      name: parsed.data.name,
      position: (count ?? 0) + 1,
    })
    .select("id, name")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return actionFail(
        AppErrorCode.VALIDATION_ERROR,
        "Ya tienes una categoría con ese nombre.",
        "name",
      );
    }
    console.error("[createCategory]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  revalidatePath("/pro/servicios", "layout");
  return actionOk(data);
}

/** Crea o edita un servicio (US-011). Uno nuevo va de último en su categoría. */
export async function saveService(
  input: ServiceInput,
): Promise<ActionResult<{ id: string; created: boolean }>> {
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const owner = await ownerBusinessId();
  if (!owner.ok) return { ok: false, error: owner.error };

  const { id, ...service } = parsed.data;
  const values = {
    category_id: service.categoryId,
    name: service.name,
    audience: service.audience,
    description: service.description || null,
    duration_minutes: service.durationMinutes,
    price_type: service.priceType,
    price: service.price,
    price_to: service.priceType === "range" ? service.priceTo : null,
  };
  const supabase = await createClient();

  if (id) {
    const { data, error } = await supabase
      .from("services")
      .update(values)
      .eq("id", id)
      .eq("business_id", owner.businessId)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      console.error("[saveService] update", error?.code ?? "no encontrado");
      return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
    }
  } else {
    const { count } = await supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("category_id", service.categoryId);
    const { data, error } = await supabase
      .from("services")
      .insert({
        ...values,
        business_id: owner.businessId,
        position: (count ?? 0) + 1,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[saveService] insert", error.code);
      return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
    }
    revalidatePath("/pro/servicios", "layout");
    return actionOk({ id: data.id, created: true });
  }
  revalidatePath("/pro/servicios", "layout");
  return actionOk({ id, created: false });
}

/**
 * Archivar o volver a activar (US-011). Archivado, sale de la app de clientes y del editor de
 * reservas; sus citas ya agendadas no cambian.
 */
export async function setServiceActive(input: {
  id: string;
  active: boolean;
}): Promise<ActionResult<{ active: boolean }>> {
  const parsed = serviceStateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const owner = await ownerBusinessId();
  if (!owner.ok) return { ok: false, error: owner.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .update({ is_active: parsed.data.active })
    .eq("id", parsed.data.id)
    .eq("business_id", owner.businessId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("[setServiceActive]", error?.code ?? "no encontrado");
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  revalidatePath("/pro/servicios", "layout");
  return actionOk({ active: parsed.data.active });
}
