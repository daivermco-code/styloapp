"use server";

import { revalidatePath } from "next/cache";
import {
  firstIssue,
  NOT_SAVED,
  ownerBusinessId,
} from "@/features/business/services/owner";
import { createClient } from "@/lib/supabase/server";
import { todayInBogota } from "@/shared/lib/dates";
import {
  type ActionResult,
  actionFail,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import { type SaveClientInput, saveClientSchema } from "../types/schemas";

const CLIENT_GONE = "Este cliente ya no existe.";

/** Crea o edita la ficha de un cliente (T-10.1.3, US-048). Solo el dueño; la RLS lo repite. */
export async function saveClient(
  input: SaveClientInput,
): Promise<ActionResult<{ id: string; created: boolean }>> {
  const parsed = saveClientSchema(todayInBogota()).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const owner = await ownerBusinessId();
  if (!owner.ok) return { ok: false, error: owner.error };

  const { clientId, ...client } = parsed.data;
  const supabase = await createClient();
  let { phone } = parsed.data;
  if (clientId && phone !== undefined) {
    // Con cuenta en la app, el celular es el de su cuenta (client_book lo copia) y no se toca: si
    // no lo comparte, el dueño ni lo ve, y lo pisaría sin saber.
    const { data: current } = await supabase
      .from("clients")
      .select("profile_id")
      .eq("business_id", owner.businessId)
      .eq("id", clientId)
      .maybeSingle();
    if (current?.profile_id) phone = undefined;
  }
  const values = {
    full_name: client.fullName,
    birth_date: client.birthDate,
    gender: client.gender,
    notes: client.notes,
    whatsapp_ok: client.whatsappOk,
    promos_ok: client.promosOk,
    // Sin mandar, el celular se queda como está.
    ...(phone === undefined ? {} : { phone }),
  };

  const { data, error } = clientId
    ? await supabase
        .from("clients")
        .update(values)
        .eq("business_id", owner.businessId)
        .eq("id", clientId)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("clients")
        .insert({ ...values, business_id: owner.businessId })
        .select("id")
        .single();
  if (error) {
    console.error("[saveClient]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  if (!data) return actionFail(AppErrorCode.NOT_FOUND, CLIENT_GONE);
  revalidatePath("/pro", "layout");
  return actionOk({ id: data.id, created: !clientId });
}
