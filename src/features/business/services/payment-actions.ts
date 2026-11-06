"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  actionFail,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import {
  type PaymentMethodIdInput,
  paymentMethodIdSchema,
  type PaymentMethodInput,
  paymentMethodSchema,
} from "../types/schemas";
import type { PaymentMethod } from "../types/payment";
import { firstIssue, NOT_SAVED, ownerBusinessId } from "./owner";

// Textos de US-039.
const DUPLICATE = "Ya tienes un método con ese nombre.";
const LAST_ACTIVE = "Deja al menos un método de pago activo.";
const IN_USE =
  "Este método ya está en facturas o gastos. Desactívalo en lugar de borrarlo.";
const GONE = "Ese método de pago ya no existe.";

const PATH = "/pro/configurar/metodos-de-pago";

/** Error de la base → el texto de la historia. LAST_ACTIVE_METHOD viene de payment_methods_guard. */
function methodError<T>(
  where: string,
  error: { code: string; message: string },
): ActionResult<T> {
  if (error.message === "LAST_ACTIVE_METHOD") {
    return actionFail(AppErrorCode.LAST_ACTIVE, LAST_ACTIVE);
  }
  if (error.code === "23505") {
    return actionFail(AppErrorCode.DUPLICATE_NAME, DUPLICATE, "name");
  }
  if (error.code === "23503") {
    return actionFail(AppErrorCode.IN_USE, IN_USE);
  }
  console.error(`[${where}]`, error.code);
  return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
}

/**
 * Crea un método de pago, o le cambia el nombre y si está activo (US-039). El nombre no se repite
 * en el negocio, sin importar mayúsculas; los nuevos van al final.
 */
export async function savePaymentMethod(
  input: PaymentMethodInput,
): Promise<ActionResult<PaymentMethod>> {
  const parsed = paymentMethodSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const owner = await ownerBusinessId();
  if (!owner.ok) return { ok: false, error: owner.error };

  const { id, name, isActive } = parsed.data;
  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("payment_methods")
    .select("id, name, position")
    .eq("business_id", owner.businessId);
  if (readError) return methodError("savePaymentMethod", readError);
  const taken = current.some(
    (method) =>
      method.id !== id &&
      method.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"),
  );
  if (taken) return actionFail(AppErrorCode.DUPLICATE_NAME, DUPLICATE, "name");

  const query = id
    ? supabase
        .from("payment_methods")
        .update({ name, is_active: isActive })
        .eq("id", id)
        .eq("business_id", owner.businessId)
    : supabase.from("payment_methods").insert({
        business_id: owner.businessId,
        name,
        is_active: isActive,
        position: Math.max(0, ...current.map((method) => method.position)) + 1,
      });
  const { data, error } = await query
    .select("id, name, is_active")
    .maybeSingle();
  if (error) return methodError("savePaymentMethod", error);
  if (!data) return actionFail(AppErrorCode.NOT_FOUND, GONE);
  revalidatePath(PATH);
  return actionOk({ id: data.id, name: data.name, isActive: data.is_active });
}

/**
 * Borra un método de pago que nunca se usó (US-039). Si ya está en facturas o gastos, la base no
 * lo deja borrar y la pantalla ofrece desactivarlo.
 */
export async function deletePaymentMethod(
  input: PaymentMethodIdInput,
): Promise<ActionResult<{ name: string }>> {
  const parsed = paymentMethodIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const owner = await ownerBusinessId();
  if (!owner.ok) return { ok: false, error: owner.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .delete()
    .eq("id", parsed.data.id)
    .eq("business_id", owner.businessId)
    .select("name")
    .maybeSingle();
  if (error) return methodError("deletePaymentMethod", error);
  if (!data) return actionFail(AppErrorCode.NOT_FOUND, GONE);
  revalidatePath(PATH);
  return actionOk({ name: data.name });
}
