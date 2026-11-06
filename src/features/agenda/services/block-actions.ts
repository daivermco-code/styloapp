"use server";

import { revalidatePath } from "next/cache";
import { getCurrentPerson } from "@/features/auth/services/queries";
import {
  firstIssue,
  NOT_SAVED,
  OWNER_ONLY,
  SIGN_IN_AGAIN,
} from "@/features/business/services/owner";
import { createClient } from "@/lib/supabase/server";
import { bogotaDateTime } from "@/shared/lib/dates";
import {
  type ActionResult,
  actionFail,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import {
  BLOCK_OVERLAP,
  BLOCK_GONE,
  NO_BLOCK_PERMISSION,
} from "../types/messages";
import {
  type BlockIdInput,
  blockIdSchema,
  type ClientBlockInput,
  clientBlockSchema,
  type CreateBlockInput,
  createBlockSchema,
} from "../types/schemas";
import { INSUFFICIENT_PRIVILEGE } from "./booking-errors";
import { getAgendaViewer } from "./queries";

/** Bloquea o desbloquea a un cliente desde su cita (US-020). Solo el dueño. */
export async function setClientBlocked(
  input: ClientBlockInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = clientBlockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const person = await getCurrentPerson();
  const viewer = person ? await getAgendaViewer(person) : null;
  if (!viewer) return actionFail(AppErrorCode.UNAUTHORIZED, SIGN_IN_AGAIN);
  if (viewer.side !== "owner") {
    return actionFail(AppErrorCode.FORBIDDEN, OWNER_ONLY);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ is_blocked: parsed.data.blocked })
    .eq("id", parsed.data.clientId)
    .eq("business_id", viewer.businessId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[setClientBlocked]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  if (!data) {
    return actionFail(AppErrorCode.NOT_FOUND, "Este cliente ya no existe.");
  }
  revalidatePath("/pro", "layout");
  return actionOk(data);
}

/** Cierra un espacio de la agenda (US-021): el dueño en cualquier columna; el profesional, en la suya y con permiso. */
export async function createBlock(
  input: CreateBlockInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createBlockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const values = parsed.data;
  const person = await getCurrentPerson();
  const viewer = person ? await getAgendaViewer(person) : null;
  if (!viewer) return actionFail(AppErrorCode.UNAUTHORIZED, SIGN_IN_AGAIN);
  if (
    !viewer.canBlock ||
    (viewer.side === "staff" && values.staffId !== viewer.staffId)
  ) {
    return actionFail(AppErrorCode.NO_PERMISSION_TEAM, NO_BLOCK_PERMISSION);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agenda_blocks")
    .insert({
      business_id: viewer.businessId,
      staff_id: values.staffId,
      starts_at: bogotaDateTime(values.day, values.starts).toISOString(),
      ends_at: bogotaDateTime(values.day, values.ends).toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    if (error.message === "BLOCK_OVERLAP") {
      return actionFail(AppErrorCode.SLOT_TAKEN, BLOCK_OVERLAP);
    }
    if (error.code === INSUFFICIENT_PRIVILEGE) {
      return actionFail(AppErrorCode.NO_PERMISSION_TEAM, NO_BLOCK_PERMISSION);
    }
    console.error("[createBlock]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  revalidatePath("/pro", "layout");
  return actionOk(data);
}

/** Quita un bloqueo (US-021), con los mismos permisos de crearlo. */
export async function deleteBlock(
  input: BlockIdInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = blockIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const person = await getCurrentPerson();
  const viewer = person ? await getAgendaViewer(person) : null;
  if (!viewer) return actionFail(AppErrorCode.UNAUTHORIZED, SIGN_IN_AGAIN);
  if (!viewer.canBlock) {
    return actionFail(AppErrorCode.NO_PERMISSION_TEAM, NO_BLOCK_PERMISSION);
  }

  // La RLS no da error al no dejar borrar: si no borró nada, el bloqueo no existe o no es suyo.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agenda_blocks")
    .delete()
    .eq("id", parsed.data.blockId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[deleteBlock]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  if (!data) return actionFail(AppErrorCode.NOT_FOUND, BLOCK_GONE);
  revalidatePath("/pro", "layout");
  return actionOk(data);
}
