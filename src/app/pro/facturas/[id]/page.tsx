import { Tag } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { getCurrentPerson } from "@/features/auth/services/queries";
import {
  InvoiceDetailView,
  InvoiceStatusPill,
} from "@/features/invoices/components/invoice-detail";
import {
  InvoiceList,
  InvoiceListSkeleton,
} from "@/features/invoices/components/invoice-list";
import {
  type InvoiceView,
  invoicesHref,
  parseInvoiceView,
} from "@/features/invoices/lib/filters";
import { invoiceTitle } from "@/features/invoices/lib/totals";
import {
  getInvoiceDetail,
  getInvoiceViewer,
} from "@/features/invoices/services/queries";
import type { InvoiceViewer } from "@/features/invoices/types/invoice";
import { INVOICE_GONE } from "@/features/invoices/types/messages";
import { EmptyState } from "@/shared/components/empty-state";
import { PeriodPicker } from "@/shared/components/period-picker";
import { TopBar } from "@/shared/components/top-bar";
import { todayInBogota } from "@/shared/lib/dates";
import { periodRange } from "@/shared/lib/periods";

export const metadata: Metadata = { title: "Factura" };

const invoiceId = z.uuid();

/** En computador, a la izquierda: las facturas del día de esta, como en Facturas. */
function DayInvoices({
  viewer,
  view,
}: {
  viewer: InvoiceViewer;
  view: InvoiceView;
}) {
  const range = periodRange(view.period, view.day);
  return (
    <div className="hidden h-dvh min-h-0 flex-col overflow-y-auto bg-surface lg:flex">
      <header className="flex min-h-14 items-center gap-2 px-5 shadow-card">
        <Tag className="size-6 text-primary" aria-hidden />
        <h2 className="text-18 font-bold text-primary">Facturas</h2>
      </header>
      <div className="px-6 pb-2 pt-4">
        <PeriodPicker
          period={view.period}
          day={view.day}
          hrefFor={(period, day) => invoicesHref(view, { period, day })}
        />
      </div>
      <Suspense fallback={<InvoiceListSkeleton />}>
        <InvoiceList
          viewer={viewer}
          view={view}
          range={range}
          staffId={viewer.side === "owner" ? null : viewer.staffId}
        />
      </Suspense>
    </div>
  );
}

// Detalle de una factura (T-8.2.2, US-043, pantalla 9). En el celular ocupa la pantalla y la
// flecha vuelve a Facturas en el día de la factura; en computador, como el editor de reservas,
// las facturas de ese día quedan a la izquierda y el detalle en el panel de la derecha. El
// profesional solo llega a las facturas con servicios suyos (RLS): las demás dicen que no existen.
export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const person = await getCurrentPerson();
  if (!person) redirect(`/entrar?siguiente=/pro/facturas/${id}`);
  const viewer = await getInvoiceViewer(person);
  // El proxy solo deja entrar a /pro a quien tiene una fila activa en staff (invariante 1).
  if (!viewer) redirect("/pro");

  const today = todayInBogota();
  const detail = invoiceId.safeParse(id).success
    ? await getInvoiceDetail(viewer, id)
    : null;
  if (!detail) {
    return (
      <div className="min-h-dvh bg-surface">
        <TopBar title="Factura" icon={<Tag />} backHref="/pro/facturas" />
        <EmptyState message={INVOICE_GONE} />
      </div>
    );
  }

  const view = parseInvoiceView({ dia: detail.issuedOn }, today);
  return (
    <div className="h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_440px]">
      <DayInvoices viewer={viewer} view={view} />
      <div className="h-dvh overflow-y-auto bg-surface lg:border-l lg:border-line">
        <TopBar
          title={invoiceTitle(detail.number)}
          backHref={invoicesHref(view)}
          actions={<InvoiceStatusPill status={detail.status} />}
        />
        <InvoiceDetailView detail={detail} owner={viewer.side === "owner"} />
      </div>
    </div>
  );
}
