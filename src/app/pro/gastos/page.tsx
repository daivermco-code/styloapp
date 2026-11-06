import { HandCoins, Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOwner } from "@/features/business/services/queries";
import {
  ExpenseList,
  ExpenseListSkeleton,
} from "@/features/expenses/components/expense-list";
import {
  type ExpenseSearchParams,
  expensesHref,
  parseExpenseView,
} from "@/features/expenses/lib/view";
import { Fab } from "@/shared/components/fab";
import { PeriodPicker } from "@/shared/components/period-picker";
import { TopBar } from "@/shared/components/top-bar";
import { todayInBogota } from "@/shared/lib/dates";
import { EXPENSE_PERIODS, periodRange } from "@/shared/lib/periods";
import { PendingArea } from "@/shared/components/instant-nav";
import { NAV_GROUP } from "@/shared/lib/instant-nav";

export const metadata: Metadata = { title: "Gastos" };

// Gastos del dueño (T-9.1.1, US-044, pantalla 11, captura 33). Lo que se mira va en la URL
// (?periodo=, ?dia=). Al profesional, requireOwner lo manda al inicio, y la RLS lo repite.
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<ExpenseSearchParams>;
}) {
  const owner = await requireOwner("/pro/gastos");
  const view = parseExpenseView(await searchParams, todayInBogota());
  const range = periodRange(view.period, view.day);

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <TopBar title="Gastos" icon={<HandCoins />} backHref="/pro" />
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col">
        <div className="px-5 pb-2 pt-4 md:px-6">
          <PeriodPicker
            period={view.period}
            day={view.day}
            periods={EXPENSE_PERIODS}
            variant="underline"
            hrefFor={(period, day) => expensesHref({ period, day })}
          />
        </div>
        <PendingArea
          groups={[NAV_GROUP.period, NAV_GROUP.periodShift]}
          fallback={<ExpenseListSkeleton />}
        >
          <Suspense
            key={`${range.from}-${range.to}`}
            fallback={<ExpenseListSkeleton />}
          >
            <ExpenseList businessId={owner.business.id} range={range} />
          </Suspense>
        </PendingArea>
      </main>
      <Fab
        href="/pro/gastos/nuevo"
        label="Agregar gasto"
        icon={<Plus />}
        extended
      />
    </div>
  );
}
