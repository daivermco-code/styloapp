"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { firstIssue, SIGN_IN_AGAIN } from "@/features/business/services/owner";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  actionFail,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";

const followSchema = z.object({
  businessId: z.uuid("Este negocio ya no existe."),
});
export type ToggleFollowInput = z.input<typeof followSchema>;

const NOT_SAVED_FOLLOW = "No pudimos guardar el cambio. Inténtalo de nuevo.";

/**
 * Seguir o dejar de seguir un negocio (US-026). Pide sesión: sin ella, la página muestra "Mejora
 * tu experiencia" antes de llamar. La RLS de `follows` solo deja escribir las filas propias.
 * Devuelve si quedó siguiéndolo.
 */
export async function toggleFollow(
  input: ToggleFollowInput,
): Promise<ActionResult<{ following: boolean }>> {
  const parsed = followSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionFail(AppErrorCode.UNAUTHORIZED, SIGN_IN_AGAIN);

  const { businessId } = parsed.data;
  const { data: removed, error: deleteError } = await supabase
    .from("follows")
    .delete()
    .eq("profile_id", user.id)
    .eq("business_id", businessId)
    .select("business_id");
  if (deleteError) {
    console.error("[toggleFollow]", deleteError.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED_FOLLOW);
  }
  if (removed.length === 0) {
    const { error } = await supabase
      .from("follows")
      .insert({ business_id: businessId });
    if (error) {
      console.error("[toggleFollow]", error.code);
      return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED_FOLLOW);
    }
  }
  revalidatePath("/app", "layout");
  return actionOk({ following: removed.length === 0 });
}
