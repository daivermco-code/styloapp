import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PeriodRange } from "@/shared/lib/periods";
import type { Expense, ExpenseListItem } from "../types/expense";

// Gastos del dueño (US-044). La RLS solo deja leerlos al dueño de ese negocio.

const COLUMNS = "id, name, category, paid_on, amount, payment_method_id";

interface ExpenseRow {
  id: string;
  name: string;
  category: Expense["category"];
  paid_on: string;
  amount: number;
  payment_method_id: string | null;
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    paidOn: row.paid_on,
    amount: row.amount,
    paymentMethodId: row.payment_method_id,
  };
}

/** Los gastos del periodo, del día más reciente al más viejo y, en un mismo día, el último anotado primero. */
export async function getExpenses(
  businessId: string,
  range: PeriodRange,
): Promise<ExpenseListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select(`${COLUMNS}, payment_methods (name)`)
    .eq("business_id", businessId)
    .gte("paid_on", range.from)
    .lte("paid_on", range.to)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false })
    // Los de la semilla entran en una sola sentencia, con el mismo created_at: sin esto, su orden
    // cambiaba al editar uno.
    .order("id", { ascending: false });
  if (error) {
    console.error("[getExpenses]", error.code);
    throw new Error("No se pudieron cargar los gastos.");
  }
  return (data ?? []).map((row) => ({
    ...toExpense(row),
    methodName: row.payment_methods?.name ?? null,
  }));
}

/** Un gasto del negocio para editarlo, o null si no existe o es de otro. */
export async function getExpense(
  businessId: string,
  expenseId: string,
): Promise<Expense | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select(COLUMNS)
    .eq("business_id", businessId)
    .eq("id", expenseId)
    .maybeSingle();
  return data ? toExpense(data) : null;
}
