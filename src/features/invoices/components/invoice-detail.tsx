import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type DetailRow, DetailRows } from "@/shared/components/detail-rows";
import { formatLongDate } from "@/shared/lib/dates";
import { formatCOP } from "@/shared/lib/money";
import {
  bookingLabel,
  commissionLabel,
  payoutText,
  voidedText,
} from "../lib/detail";
import type { InvoiceStatus } from "../lib/totals";
import type { InvoiceDetail, InvoiceDetailLine } from "../types/invoice";
import { InvoiceDetailActions } from "./invoice-detail-actions";

const ROW_LINK =
  "-my-2 inline-flex min-h-11 items-center gap-1 rounded-card text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** La pastilla de la barra: "Pagada" en verde; "Anulada" en rojo. */
export function InvoiceStatusPill({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-12 font-bold",
        status === "paid"
          ? "bg-success/10 text-success"
          : "bg-danger/10 text-danger",
      )}
    >
      {status === "paid" ? "Pagada" : "Anulada"}
    </span>
  );
}

function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={ROW_LINK}>
      {children}
      <ChevronRight className="size-5 shrink-0 text-slate" aria-hidden />
    </Link>
  );
}

function headerRows(detail: InvoiceDetail, owner: boolean): DetailRow[] {
  const rows: DetailRow[] = [
    {
      label: "Fecha",
      value: formatLongDate(`${detail.issuedOn}T12:00:00-05:00`),
    },
    {
      label: "Cliente",
      // La ficha del cliente es del dueño (US-043); el profesional solo lee el nombre.
      value:
        owner && detail.clientId ? (
          <RowLink href={`/pro/clientes/${detail.clientId}`}>
            {detail.clientName}
          </RowLink>
        ) : (
          detail.clientName
        ),
    },
  ];
  if (detail.booking) {
    rows.push({
      label: "Cita",
      value: (
        <RowLink href={`/pro/agenda?cita=${detail.booking.id}`}>
          {bookingLabel(detail.booking.startsAt)}
        </RowLink>
      ),
    });
  }
  rows.push({ label: "Método", value: detail.methodName });
  if (detail.createdByName) {
    rows.push({ label: "Hecha por", value: detail.createdByName });
  }
  return rows;
}

function LineItem({ line }: { line: InvoiceDetailLine }) {
  return (
    <li className="flex flex-col gap-0.5 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-16 text-ink">{line.serviceName}</span>
        <span className="text-16 text-ink">{formatCOP(line.price)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-4 text-12 text-slate">
        <span>
          {line.staffName} · {commissionLabel(line.commissionPct)}
        </span>
        <span>{formatCOP(line.commission)}</span>
      </div>
    </li>
  );
}

/** Lo que va debajo del total: anulada, ya pagada al profesional, o los botones. */
function DetailFooter({ detail }: { detail: InvoiceDetail }) {
  if (detail.status === "void") {
    const text = voidedText(detail.voidedByName, detail.voidedAt);
    return text ? (
      <p className="text-14 font-bold text-danger">{text}</p>
    ) : null;
  }
  if (detail.payouts.length > 0) {
    return (
      <ul className="flex flex-col gap-1">
        {detail.payouts.map((payout) => (
          <li key={payout.key} className="text-14 text-slate">
            {payoutText(payout)}
          </li>
        ))}
      </ul>
    );
  }
  if (!detail.canChange) return null;
  return (
    <InvoiceDetailActions invoiceId={detail.id} invoiceNumber={detail.number} />
  );
}

interface InvoiceDetailViewProps {
  detail: InvoiceDetail;
  /** El dueño ve el enlace a la ficha del cliente. */
  owner: boolean;
}

// Detalle de la factura (T-8.2.2, US-043, pantalla 9): filas etiqueta–valor, cada servicio con
// su profesional y su comisión en 12 gris, y el total. Al profesional la RLS le deja solo sus
// servicios, y el total es la suma de esos. Editar y Anular salen solo si se puede (la base lo
// vuelve a revisar); anulada o ya pagada al profesional, dice por qué y no hay botones.
export function InvoiceDetailView({ detail, owner }: InvoiceDetailViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2 px-5 pb-8 pt-2 md:px-6">
      <DetailRows rows={headerRows(detail, owner)} />
      <ul
        aria-label="Servicios"
        className="divide-y divide-line border-y border-line"
      >
        {detail.lines.map((line) => (
          <LineItem key={line.id} line={line} />
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-4 py-3">
        <span className="text-16 font-bold text-ink">Total</span>
        <span
          className={cn(
            "text-18 font-bold",
            detail.status === "void"
              ? "text-slate line-through"
              : "text-primary",
          )}
        >
          {formatCOP(detail.total)}
        </span>
      </div>
      <div className="pt-2">
        <DetailFooter detail={detail} />
      </div>
    </div>
  );
}
