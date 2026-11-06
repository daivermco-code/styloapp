import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/shared/components/empty-state";
import { MoneyRow } from "@/shared/components/money-row";
import { formatDayOfMonth } from "@/shared/lib/dates";
import { formatCOP } from "@/shared/lib/money";
import type { PeriodRange } from "@/shared/lib/periods";
import { expensesTotal } from "../lib/view";
import { getExpenses } from "../services/queries";
import { CATEGORY_LABELS, type ExpenseListItem } from "../types/expense";

export const EMPTY_EXPENSES = "No hay gastos en este periodo.";

function detailOf(expense: ExpenseListItem): string {
  return [
    CATEGORY_LABELS[expense.category],
    formatDayOfMonth(expense.paidOn),
    expense.methodName,
  ]
    .filter(Boolean)
    .join(" · ");
}

function PeriodTotal({ value }: { value: number }) {
  return (
    <p
      aria-label={`Total del periodo: ${formatCOP(value)}`}
      className="flex items-baseline justify-between gap-3 px-5 pb-3 md:px-6"
    >
      <span className="text-16 text-ink">Total del periodo</span>
      <span className="text-16 font-bold text-primary">{formatCOP(value)}</span>
    </p>
  );
}

// Lista de Gastos del periodo (T-9.1.1, US-044, pantalla 11): arriba el total del periodo y cada
// gasto como fila de dinero (nombre; categoría, fecha y método en 12 gris; el valor). Tocarlo lo
// abre en el editor.
export async function ExpenseList({
  businessId,
  range,
}: {
  businessId: string;
  range: PeriodRange;
}) {
  const expenses = await getExpenses(businessId, range);
  return (
    <>
      <PeriodTotal value={expensesTotal(expenses)} />
      {expenses.length === 0 ? (
        <EmptyState message={EMPTY_EXPENSES} className="flex-1" />
      ) : (
        // pb-24: la última fila queda encima de "Agregar gasto" y del botón de la bandeja.
        <ul className="flex-1 divide-y divide-line border-t border-line pb-24">
          {expenses.map((expense) => (
            <li key={expense.id}>
              <MoneyRow
                title={expense.name}
                detail={detailOf(expense)}
                value={expense.amount}
                href={`/pro/gastos/${expense.id}`}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// Mientras llega el periodo: el total y 4 filas en esqueleto, nunca ceros.
export function ExpenseListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando los gastos"
      className="flex flex-1 flex-col"
    >
      <div className="flex items-center justify-between gap-3 px-5 pb-3 md:px-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-t border-line px-5 py-3 md:px-6"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
