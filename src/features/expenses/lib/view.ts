import { parseDay } from "@/features/agenda/lib/grid";
import {
  EXPENSE_PERIODS,
  type Period,
  parsePeriod,
} from "@/shared/lib/periods";

// Lo que se mira en Gastos va en la URL (?periodo=, ?dia=), como en Facturas.

export interface ExpenseView {
  period: Period;
  day: string;
}

export interface ExpenseSearchParams {
  periodo?: string;
  dia?: string;
}

/**
 * Lo que dice la URL; lo que no se entiende queda en el mes de hoy. Va en Mes y no en Día: los
 * gastos (arriendo, servicios) se anotan pocas veces al mes y el total que importa es el del mes.
 */
export function parseExpenseView(
  params: ExpenseSearchParams,
  today: string,
): ExpenseView {
  return {
    period: parsePeriod(params.periodo, EXPENSE_PERIODS) ?? "mes",
    day: parseDay(params.dia) ?? today,
  };
}

/** La dirección de Gastos con ese periodo y ese día. */
export function expensesHref(view: ExpenseView): string {
  const params = new URLSearchParams({ periodo: view.period, dia: view.day });
  return `/pro/gastos?${params}`;
}

/** La suma de los gastos, en pesos enteros. */
export function expensesTotal(expenses: { amount: number }[]): number {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}
