"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  actionFail,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import {
  CODE_LIFETIME_MINUTES,
  getLoginPhone,
} from "@/features/auth/services/login-code";
import { formatPhone } from "@/shared/lib/phone";
import type { LoginCodeInbox } from "../types/inbox";
import {
  type MarkInboxReadInput,
  markInboxReadSchema,
  type ResetDemoInput,
  resetDemoSchema,
} from "../types/schemas";
import { INBOX_COLUMNS, toInboxMessage } from "./inbox-rows";

const NO_CONNECTION =
  "No hay conexión con la demo. Revisa que la base esté prendida.";

/** "Reiniciar demo" (US-005): borra todo, vuelve a sembrar y cierra las sesiones. */
export async function resetDemo(
  input: ResetDemoInput,
): Promise<ActionResult<null>> {
  if (!resetDemoSchema.safeParse(input).success) {
    return actionFail(AppErrorCode.VALIDATION_ERROR, "Confirma el reinicio.");
  }

  // Llave de servicio: uno de los tres usos permitidos (invariante 4).
  const { error } = await createAdminClient().rpc("reset_demo");
  if (error) {
    console.error("[resetDemo]", error.code, error.message);
    return actionFail(
      AppErrorCode.INTERNAL_ERROR,
      "No se pudo reiniciar. Usa `npm run db:reset` en la terminal.",
    );
  }

  // La cuenta ya no existe: se borran también las cookies de este navegador.
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });

  revalidatePath("/", "layout");
  return actionOk(null);
}

/**
 * La bandeja sin sesión (US-004): solo los códigos de entrada del celular que está entrando en
 * este navegador (la cookie de /entrar), de los últimos 10 minutos. Llave de servicio: leer el
 * código antes de tener sesión es uno de sus tres usos (invariante 4).
 */
export async function loginCodeInbox(): Promise<ActionResult<LoginCodeInbox>> {
  const phone = await getLoginPhone();
  if (!phone) return actionOk({ phoneLabel: null, messages: [] });

  const since = new Date(
    Date.now() - CODE_LIFETIME_MINUTES * 60_000,
  ).toISOString();
  const { data, error } = await createAdminClient()
    .from("demo_messages")
    .select(INBOX_COLUMNS)
    .eq("recipient_phone", phone)
    .eq("kind", "login_code")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    console.error("[loginCodeInbox]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NO_CONNECTION);
  }
  return actionOk({
    phoneLabel: formatPhone(phone),
    messages: data.map(toInboxMessage),
  });
}

/** Al abrir la bandeja con sesión, los mensajes que ya llegaron quedan leídos (US-004). */
export async function markInboxRead(
  input: MarkInboxReadInput,
): Promise<ActionResult<null>> {
  const parsed = markInboxReadSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(AppErrorCode.VALIDATION_ERROR, "Fecha inválida.");
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return actionFail(
      AppErrorCode.UNAUTHORIZED,
      "Vuelve a entrar con tu celular.",
    );
  }

  // RLS deja tocar solo los mensajes propios, y solo la columna read_at.
  const { error } = await supabase
    .from("demo_messages")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .lte("deliver_at", parsed.data.before);
  if (error) {
    console.error("[markInboxRead]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NO_CONNECTION);
  }
  return actionOk(null);
}
