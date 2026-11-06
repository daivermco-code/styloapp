import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { invoiceTitle } from "@/features/invoices/lib/totals";
import { formatDayOfMonth, formatLongDate } from "@/shared/lib/dates";
import { formatCOP } from "@/shared/lib/money";
import type { PaymentDetail as Detail } from "../types/payroll";

// Detalle de un pago (T-9.3.1, US-046, pantalla 13): el valor en Bold 30, la fecha larga con el
// método, la nota si la tiene y las facturas que cubrió, cada servicio con su comisión y el
// enlace a su factura.
export function PaymentDetail({ payment }: { payment: Detail }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-30 font-bold text-primary">
          {formatCOP(payment.amount)}
        </p>
        <p className="text-16 text-ink first-letter:uppercase">
          {formatLongDate(`${payment.paidOn}T12:00:00-05:00`)}
          {payment.methodName && ` · ${payment.methodName}`}
        </p>
        {payment.note && (
          <p className="text-14 text-slate">Nota: {payment.note}</p>
        )}
      </div>
      <section aria-labelledby="covered-title" className="flex flex-col">
        <h2
          id="covered-title"
          className="border-b border-line pb-2 text-16 font-bold text-ink"
        >
          Servicios que cubrió
        </h2>
        <ul className="divide-y divide-line">
          {payment.items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/pro/facturas/${item.invoiceId}`}
                className="flex min-h-14 items-center gap-3 py-3 transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-16 text-ink">
                    {invoiceTitle(item.invoiceNumber)} ·{" "}
                    {formatDayOfMonth(item.issuedOn)}
                  </span>
                  <span className="text-12 text-slate">
                    {item.serviceName} · {formatCOP(item.price)}
                  </span>
                </span>
                <span className="shrink-0 text-16 font-bold text-ink">
                  <span className="sr-only">Comisión: </span>
                  {formatCOP(item.commission)}
                </span>
                <ChevronRight
                  className="size-5 shrink-0 text-slate"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
