import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/shared/components/empty-state";
import { formatDayOfMonth } from "@/shared/lib/dates";
import { formatCOP } from "@/shared/lib/money";
import { groupByMonth } from "../lib/payroll";
import type { PaymentListItem } from "../types/payroll";
import { Initial } from "./payroll-list";

export const NO_PAYMENTS = "Aún no le has pagado a tu equipo.";

function PaymentRow({ payment }: { payment: PaymentListItem }) {
  return (
    <Link
      href={`/pro/pagos/${payment.id}`}
      className="flex min-h-14 items-center gap-3 px-5 py-3 transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-6"
    >
      <Initial name={payment.staffName} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-16 text-ink">{payment.staffName}</span>
        <span className="text-12 text-slate">
          {[formatDayOfMonth(payment.paidOn), payment.methodName]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span className="shrink-0 text-16 font-bold text-primary">
        {formatCOP(payment.amount)}
      </span>
      <ChevronRight className="size-5 shrink-0 text-slate" aria-hidden />
    </Link>
  );
}

// Historial de pagos (T-9.3.1, US-046, pantalla 13, captura 35): los pagos al equipo agrupados
// por mes, del más reciente al más viejo; cada uno con el profesional, el día, el método y el
// valor, y abre su detalle.
export function PaymentList({ payments }: { payments: PaymentListItem[] }) {
  if (payments.length === 0) return <EmptyState message={NO_PAYMENTS} />;
  return (
    <div className="flex flex-col gap-4 pb-24">
      {groupByMonth(payments).map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h2 className="px-5 pb-1 text-16 font-bold text-ink md:px-6">
            {group.title}
          </h2>
          <ul className="divide-y divide-line">
            {group.items.map((payment) => (
              <li key={payment.id}>
                <PaymentRow payment={payment} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
