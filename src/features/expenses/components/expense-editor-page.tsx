import { SquarePen } from "lucide-react";
import { getPaymentMethods } from "@/features/business/services/queries";
import { TopBar } from "@/shared/components/top-bar";
import { todayInBogota } from "@/shared/lib/dates";
import { expensesHref } from "../lib/view";
import type { Expense } from "../types/expense";
import { ExpenseForm } from "./expense-form";

// La página del editor de gastos (T-9.1.1, captura 55), para crear y para editar: "Editor de
// gastos" con el lápiz. En la lista de métodos van los activos y, al editar, el del gasto aunque
// se haya desactivado después.
export async function ExpenseEditorPage({
  businessId,
  expense,
}: {
  businessId: string;
  expense: Expense | null;
}) {
  const today = todayInBogota();
  const methods = (await getPaymentMethods(businessId)).filter(
    (method) => method.isActive || method.id === expense?.paymentMethodId,
  );
  const back = expensesHref({ period: "mes", day: expense?.paidOn ?? today });

  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title="Editor de gastos" icon={<SquarePen />} backHref={back} />
      <main className="mx-auto flex max-w-[720px] flex-col px-5 pb-24 pt-6 md:px-6">
        <ExpenseForm expense={expense} methods={methods} today={today} />
      </main>
    </div>
  );
}
