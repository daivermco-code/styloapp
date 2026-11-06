"use server";

import { isAuthApiError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  actionFail,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import {
  type CompleteProfileInput,
  completeProfileSchema,
  type RequestCodeInput,
  requestCodeSchema,
  type VerifyCodeInput,
  verifyCodeSchema,
} from "../types/schemas";
import type { CodeNotice } from "../types/code-notice";
import { destinationAfterLogin } from "./destination";
import {
  clearLoginPhone,
  getLoginPhone,
  latestLoginCode,
  setLoginPhone,
} from "./login-code";

// Textos de US-003.
const NO_CONNECTION =
  "No hay conexión con la demo. Revisa que la base esté prendida.";
const WRONG_CODE =
  "Ese código no coincide. Míralo en la bandeja y vuelve a intentarlo.";
const EXPIRED_CODE = "Ese código ya venció. Pide uno nuevo.";
const TOO_SOON = "Espera un momento antes de pedir otro código.";

function isConnectionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { name, status } = error as { name?: string; status?: number };
  return (
    name === "AuthRetryableFetchError" || status === 0 || name === "TypeError"
  );
}

type SentCode = { notice: CodeNotice | null };

/** El SMS recién llegado, para el aviso de arriba (últimos 10 minutos). */
async function codeNotice(phone: string): Promise<CodeNotice | null> {
  const latest = await latestLoginCode(phone);
  if (!latest || latest.expired) return null;
  const { id, title, body, createdAt } = latest;
  return { id, title, body, createdAt };
}

async function sendCode(phone: string): Promise<ActionResult<SentCode>> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (!error) return actionOk({ notice: await codeNotice(phone) });
    if (isConnectionError(error)) {
      return actionFail(AppErrorCode.INTERNAL_ERROR, NO_CONNECTION);
    }
    if (error.status === 429) {
      return actionFail(AppErrorCode.VALIDATION_ERROR, TOO_SOON);
    }
    console.error("[sendCode]", error.code, error.status);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NO_CONNECTION);
  } catch (error) {
    console.error("[sendCode]", error instanceof Error ? error.name : error);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NO_CONNECTION);
  }
}

/** "Enviar código": el hook deja el código en la bandeja (nada sale del computador). */
export async function requestCode(
  input: RequestCodeInput,
): Promise<ActionResult<SentCode>> {
  const parsed = requestCodeSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(
      AppErrorCode.VALIDATION_ERROR,
      parsed.error.issues[0].message,
      "phone",
    );
  }
  const result = await sendCode(parsed.data.phone);
  if (result.ok) await setLoginPhone(parsed.data.phone);
  return result;
}

/** "Pedir uno nuevo" desde la pantalla del código. */
export async function resendCode(): Promise<ActionResult<SentCode>> {
  const phone = await getLoginPhone();
  if (!phone) {
    return actionFail(
      AppErrorCode.VALIDATION_ERROR,
      "Vuelve a escribir tu celular.",
    );
  }
  return sendCode(phone);
}

/** "Enviar" en la pantalla del código: abre la sesión y dice a dónde ir. */
export async function verifyCode(
  input: VerifyCodeInput,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = verifyCodeSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(
      AppErrorCode.VALIDATION_ERROR,
      parsed.error.issues[0].message,
      "code",
    );
  }
  const phone = await getLoginPhone();
  if (!phone) {
    return actionFail(
      AppErrorCode.VALIDATION_ERROR,
      "Vuelve a escribir tu celular.",
    );
  }

  try {
    // Supabase da el mismo error para un código errado y uno vencido: se distinguen por la
    // hora del último mensaje (más de 10 minutos, venció).
    const latest = await latestLoginCode(phone);
    if (!latest || latest.expired) {
      return actionFail(AppErrorCode.INVALID_CODE, EXPIRED_CODE, "code");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: parsed.data.code,
      type: "sms",
    });
    if (error || !data.user) {
      if (error && isConnectionError(error)) {
        return actionFail(AppErrorCode.INTERNAL_ERROR, NO_CONNECTION);
      }
      if (error && !isAuthApiError(error))
        console.error("[verifyCode]", error.name);
      return actionFail(AppErrorCode.INVALID_CODE, WRONG_CODE, "code");
    }

    await clearLoginPhone();
    const redirectTo = await destinationAfterLogin(
      supabase,
      data.user,
      parsed.data.next,
    );
    revalidatePath("/", "layout");
    return actionOk({ redirectTo });
  } catch (error) {
    console.error("[verifyCode]", error instanceof Error ? error.name : error);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NO_CONNECTION);
  }
}

/** Completar el perfil la primera vez (nombre obligatorio, género y fecha opcionales). */
export async function completeProfile(
  input: CompleteProfileInput,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = completeProfileSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return actionFail(
      AppErrorCode.VALIDATION_ERROR,
      issue.message,
      String(issue.path[0] ?? ""),
    );
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

  const { fullName, gender, birthDate, next } = parsed.data;
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      gender: gender ?? null,
      birth_date: birthDate ?? null,
    })
    .eq("id", user.id);
  if (error) {
    console.error("[completeProfile]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NO_CONNECTION);
  }

  const redirectTo = await destinationAfterLogin(supabase, user, next);
  revalidatePath("/", "layout");
  return actionOk({ redirectTo });
}

/** "Cerrar sesión" en cualquier lado: vuelve a la pantalla de inicio de la demo (US-003). */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/");
}
