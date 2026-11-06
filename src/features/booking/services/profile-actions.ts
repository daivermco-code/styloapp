"use server";

import { revalidatePath } from "next/cache";
import { firstIssue, SIGN_IN_AGAIN } from "@/features/business/services/owner";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  actionFail,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import type { PreferenceKey } from "../types/profile";
import {
  type EditProfileInput,
  editProfileSchema,
  type PreferenceInput,
  preferenceSchema,
} from "../types/schemas";

const NOT_SAVED = "No pudimos guardar el cambio. Inténtalo de nuevo.";

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Editar el perfil del cliente (US-032): nombre, género y fecha de nacimiento. La RLS de
 * `profiles` solo deja cambiar el propio y esas columnas.
 */
export async function updateClientProfile(
  input: EditProfileInput,
): Promise<ActionResult<null>> {
  const parsed = editProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const userId = await currentUserId();
  if (!userId) return actionFail(AppErrorCode.UNAUTHORIZED, SIGN_IN_AGAIN);
  const { fullName, gender, birthDate } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      gender: gender ?? null,
      birth_date: birthDate ?? null,
    })
    .eq("id", userId);
  if (error) {
    console.error("[updateClientProfile]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  revalidatePath("/", "layout");
  return actionOk(null);
}

/**
 * Un interruptor del perfil (US-032), que se guarda al tocarlo. Cambia al momento lo que ve el
 * negocio (`client_phone`) y lo que llega a la bandeja (`booking_notify`).
 */
export async function setClientPreference(
  input: PreferenceInput,
): Promise<ActionResult<null>> {
  const parsed = preferenceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const userId = await currentUserId();
  if (!userId) return actionFail(AppErrorCode.UNAUTHORIZED, SIGN_IN_AGAIN);
  const { key, value } = parsed.data;
  const supabase = await createClient();
  const change: Partial<Record<PreferenceKey, boolean>> = { [key]: value };
  const { error } = await supabase
    .from("profiles")
    .update(change)
    .eq("id", userId);
  if (error) {
    console.error("[setClientPreference]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  revalidatePath("/app/perfil");
  return actionOk(null);
}
