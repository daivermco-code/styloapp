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
import {
  type DeleteExpenseInput,
  deleteExpenseSchema,
  type SaveExpenseInput,
  saveExpenseSchema,
} from "../types/schemas";

const EXPENSE_GONE = "Este gasto ya no existe.";
const METHOD_GONE = "Ese método de pago ya no está: elige otro.";
const NOT_DELETED = "No se borró el gasto. Inténtalo de nuevo.";

/**
 * El método elegido: del negocio y activo, o el que el gasto ya tenía (aunque se haya
 * desactivado después). La RLS repite que sea del negocio.
 */
async function methodAllowed(
  businessId: string,
  methodId: string,
  expenseId: string | undefined,
): Promise<boolean> {
  const supabase = await createClient();
  const { data: method } = await supabase
    .from("payment_methods")
    .select("is_active")
    .eq("business_id", businessId)
    .eq("id", methodId)
    .maybeSingle();
  if (!method) return false;
  if (method.is_active || !expenseId) return method.is_active;
  const { data: current } = await supabase
    .from("expenses")
    .select("payment_method_id")
    .eq("id", expenseId)
    .maybeSingle();
  return current?.payment_method_id === methodId;
}

/** Crea o edita un gasto (T-9.1.1, US-044). Solo el dueño. */
export async function saveExpense(
  input: SaveExpenseInput,
): Promise<ActionResult<{ id: string; created: boolean }>> {
  const parsed = saveExpenseSchema(todayInBogota()).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const owner = await ownerBusinessId();
  if (!owner.ok) return { ok: false, error: owner.error };

  const { expenseId, paymentMethodId, ...expense } = parsed.data;
  if (
    paymentMethodId &&
    !(await methodAllowed(owner.businessId, paymentMethodId, expenseId))
  ) {
    return actionFail(
      AppErrorCode.METHOD_INACTIVE,
      METHOD_GONE,
      "paymentMethodId",
    );
  }
  const values = {
    name: expense.name,
    category: expense.category,
    paid_on: expense.paidOn,
    amount: expense.amount,
    payment_method_id: paymentMethodId ?? null,
  };

  const supabase = await createClient();
  const { data, error } = expenseId
    ? await supabase
        .from("expenses")
        .update(values)
        .eq("business_id", owner.businessId)
        .eq("id", expenseId)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("expenses")
        .insert({ ...values, business_id: owner.businessId })
        .select("id")
        .single();
  if (error) {
    console.error("[saveExpense]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_SAVED);
  }
  if (!data) return actionFail(AppErrorCode.NOT_FOUND, EXPENSE_GONE);
  revalidatePath("/pro/gastos", "layout");
  return actionOk({ id: data.id, created: !expenseId });
}

/** Borra un gasto (US-044). La confirmación la pide la pantalla. */
export async function deleteExpense(
  input: DeleteExpenseInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }
  const owner = await ownerBusinessId();
  if (!owner.ok) return { ok: false, error: owner.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("business_id", owner.businessId)
    .eq("id", parsed.data.expenseId)
    .select("id");
  if (error) {
    console.error("[deleteExpense]", error.code);
    return actionFail(AppErrorCode.INTERNAL_ERROR, NOT_DELETED);
  }
  if (!data?.length) return actionFail(AppErrorCode.NOT_FOUND, EXPENSE_GONE);
  revalidatePath("/pro/gastos", "layout");
  return actionOk({ id: parsed.data.expenseId });
}
