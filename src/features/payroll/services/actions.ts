"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import {
  firstIssue,
  NOT_SAVED,
  ownerBusinessId,
  OWNER_ONLY,
  SIGN_IN_AGAIN,
} from "@/features/business/services/owner";
import { createClient } from "@/lib/supabase/server";
import { todayInBogota } from "@/shared/lib/dates";
import {
  type ActionError,
  type ActionResult,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import { unmarkedText } from "../lib/payroll";
import {
  PAY_DATE_FUTURE,
  type PayStaffInput,
  payStaffSchema,
} from "../types/schemas";

// Los errores de pay_staff (0004_dinero.sql) en palabras. La base los manda en error.message;
// UNMARKED_BOOKINGS dice en error.details cuántas citas faltan.
function payError(error: PostgrestError): ActionError {
  switch (error.message) {
    case "NO_SESSION":
      return { code: AppErrorCode.UNAUTHORIZED, message: SIGN_IN_AGAIN };
    case "NO_PERMISSION":
      return { code: AppErrorCode.FORBIDDEN, message: OWNER_ONLY };
    case "NOT_FOUND":
      return error.details === "method"
        ? {
            code: AppErrorCode.NOT_FOUND,
            message: "Ese método de pago ya no existe. Elige otro.",
            field: "paymentMethodId",
          }
        : {
            code: AppErrorCode.NOT_FOUND,
            message: "Este profesional ya no está en tu equipo.",
          };
    case "METHOD_INACTIVE":
      return {
        code: AppErrorCode.METHOD_INACTIVE,
        message: "Ese método de pago está desactivado. Elige otro.",
        field: "paymentMethodId",
      };
    case "INVALID_DATE":
      return {
        code: AppErrorCode.VALIDATION_ERROR,
        message: PAY_DATE_FUTURE,
        field: "paidOn",
      };
    case "UNMARKED_BOOKINGS":
      return {
        code: AppErrorCode.UNMARKED_BOOKINGS,
        message: `Tiene ${unmarkedText(Number(error.details) || 1)}: márcalas antes de pagarle.`,
      };
    case "NOTHING_PENDING":
      return {
        code: AppErrorCode.NOTHING_PENDING,
        message: "Ya no tiene comisiones pendientes.",
      };
    default:
      console.error("[payStaff]", error.code);
      return { code: AppErrorCode.INTERNAL_ERROR, message: NOT_SAVED };
  }
}

/**
 * Le paga a un profesional todo lo pendiente (T-9.2.2, US-045). El valor no viene de la pantalla:
 * pay_staff lo suma en la base, así que si entró otra factura entre ver y confirmar, el pago la
 * incluye, y el aviso dice el valor real que quedó guardado. Si no se alcanza a leer, amount va
 * null: el pago ya se hizo y el aviso sale sin cifra, nunca con $ 0.
 */
export async function payStaff(
  input: PayStaffInput,
): Promise<ActionResult<{ paymentId: string; amount: number | null }>> {
  const parsed = payStaffSchema(todayInBogota()).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const owner = await ownerBusinessId();
  if (!owner.ok) return { ok: false, error: owner.error };

  const supabase = await createClient();
  const { data: paymentId, error } = await supabase.rpc("pay_staff", {
    p_business: owner.businessId,
    p_staff: parsed.data.staffId,
    p_method: parsed.data.paymentMethodId,
    p_day: parsed.data.paidOn,
    p_note: parsed.data.note || undefined,
  });
  if (error) return { ok: false, error: payError(error) };
  const { data: payment, error: readError } = await supabase
    .from("staff_payments")
    .select("amount")
    .eq("id", paymentId)
    .maybeSingle();
  if (readError) console.error("[payStaff] amount", readError.code);
  // Cambian el liquidador, el historial y las facturas que quedaron pagadas al profesional.
  revalidatePath("/pro", "layout");
  return actionOk({ paymentId, amount: payment?.amount ?? null });
}
