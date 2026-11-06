import { Tag } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { InvoiceFilters } from "@/features/invoices/components/invoice-filters";
import {
  InvoiceList,
  InvoiceListSkeleton,
} from "@/features/invoices/components/invoice-list";
import { InvoiceStaffRow } from "@/features/invoices/components/invoice-staff-row";
import { NewInvoiceFab } from "@/features/invoices/components/new-invoice-fab";
import {
  FILTER_OPTIONS,
  type InvoiceSearchParams,
  type InvoiceView,
  invoicesHref,
  ORDER_OPTIONS,
  parseInvoiceView,
} from "@/features/invoices/lib/filters";
import {
  getInvoiceStaffOptions,
  getInvoiceViewer,
} from "@/features/invoices/services/queries";
import { PeriodPicker } from "@/shared/components/period-picker";
import type { InvoiceViewer } from "@/features/invoices/types/invoice";
import { TopBar } from "@/shared/components/top-bar";
import { todayInBogota } from "@/shared/lib/dates";
import { periodRange } from "@/shared/lib/periods";
import { PendingArea } from "@/shared/components/instant-nav";
import { NAV_GROUP } from "@/shared/lib/instant-nav";

export const metadata: Metadata = { title: "Facturas" };

function filterChoices(view: InvoiceView) {
  return {
    filters: FILTER_OPTIONS.map((option) => ({
      label: option.label,
      href: invoicesHref(view, { filter: option.value }),
      selected: option.value === view.filter,
    })),
    orders: ORDER_OPTIONS.map((option) => ({
      label: option.label,
      href: invoicesHref(view, { order: option.value }),
      selected: option.value === view.order,
    })),
  };
}

/**
 * Lo que se mira, con un ?pro= que no es del equipo de vuelta en "Todos". El profesional no elige:
 * mira lo suyo.
 */
async function resolveView(viewer: InvoiceViewer, params: InvoiceSearchParams) {
  const parsed = parseInvoiceView(params, todayInBogota());
  const staffOptions =
    viewer.side === "owner"
      ? await getInvoiceStaffOptions(viewer.businessId)
      : [];
  const view: InvoiceView = {
    ...parsed,
    staffId: staffOptions.some((option) => option.id === parsed.staffId)
      ? parsed.staffId
      : null,
  };
  return {
    view,
    staffOptions,
    staffId: viewer.side === "owner" ? view.staffId : viewer.staffId,
    range: periodRange(view.period, view.day),
  };
}

// Facturas del dueño y del profesional (T-8.2.1, US-042, pantalla 7). Lo que se mira va en la URL
// (?periodo=, ?dia=, ?pro=, ?filtro=, ?orden=). El dueño elige el profesional; el profesional solo
// ve las facturas con servicios suyos, y la RLS lo repite en la base. Al cambiar de periodo o de
// profesional, el Suspense con llave muestra el esqueleto mientras llegan.
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<InvoiceSearchParams>;
}) {
  const person = await getCurrentPerson();
  if (!person) redirect("/entrar?siguiente=/pro/facturas");
  const viewer = await getInvoiceViewer(person);
  // El proxy solo deja entrar a /pro a quien tiene una fila activa en staff (invariante 1).
  if (!viewer) redirect("/pro");

  const { view, staffOptions, staffId, range } = await resolveView(
    viewer,
    await searchParams,
  );
  const owner = viewer.side === "owner";
  const { filters, orders } = filterChoices(view);

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <TopBar
        title="Facturas"
        icon={<Tag />}
        backHref="/pro"
        actions={<InvoiceFilters filters={filters} orders={orders} />}
      />
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col">
        <div className="flex flex-col gap-4 px-5 pb-2 pt-4 md:px-6">
          <PeriodPicker
            period={view.period}
            day={view.day}
            hrefFor={(period, day) => invoicesHref(view, { period, day })}
          />
          {owner && (
            <InvoiceStaffRow
              options={staffOptions}
              selectedId={view.staffId}
              hrefFor={(id) => invoicesHref(view, { staffId: id })}
            />
          )}
        </div>
        <PendingArea
          groups={[
            NAV_GROUP.period,
            NAV_GROUP.periodShift,
            NAV_GROUP.staff,
            NAV_GROUP.invoiceFilters,
            NAV_GROUP.invoiceOrder,
          ]}
          fallback={<InvoiceListSkeleton />}
        >
          <Suspense
            key={`${range.from}-${range.to}-${staffId ?? "todos"}`}
            fallback={<InvoiceListSkeleton />}
          >
            <InvoiceList
              viewer={viewer}
              view={view}
              range={range}
              staffId={staffId}
            />
          </Suspense>
        </PendingArea>
      </main>
      <NewInvoiceFab canInvoice={viewer.canInvoice} />
    </div>
  );
}
