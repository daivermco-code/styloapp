import { CircleX } from "lucide-react";
import { InvoiceStaffRow } from "@/features/invoices/components/invoice-staff-row";
import type { InvoiceStaffOption } from "@/features/invoices/types/invoice";
import { InstantLink } from "@/shared/components/instant-nav";
import { PeriodPicker } from "@/shared/components/period-picker";
import { NAV_GROUP } from "@/shared/lib/instant-nav";
import { rangeLabel, reportsHref } from "../lib/display";
import type { ReportTab, ReportView } from "../lib/filters";
import { ReportTabs } from "./report-tabs";

interface ReportFiltersProps {
  view: ReportView;
  tabs: readonly ReportTab[];
  /** La fila de profesionales del dueño; el profesional no la tiene. */
  staffOptions: InvoiceStaffOption[] | null;
}

/** Con un rango: la "x" de 44 px que vuelve al periodo de antes y la fecha, como la captura 164. */
function RangeRow({ view }: { view: ReportView }) {
  if (!view.range) return null;
  return (
    <div className="grid grid-cols-[44px_1fr_44px] items-center gap-1">
      <InstantLink
        href={reportsHref(view, { range: null })}
        group={NAV_GROUP.reportRange}
        selectable={false}
        aria-label="Quitar el rango"
        className="flex size-11 items-center justify-center rounded-full text-slate hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CircleX className="size-7" />
      </InstantLink>
      <p className="text-center text-14 text-ink" aria-live="polite">
        {rangeLabel(view.range)}
      </p>
    </div>
  );
}

// La parte de arriba de Informes (T-13.1.1, UI Pantallas 19 y 22): los chips de periodo con sus
// flechas (o el rango con su "x"), las pestañas cuadradas y, para el dueño, la fila de
// profesionales de Facturas. Todo son enlaces que cambian la URL sin perder lo demás.
export function ReportFilters({
  view,
  tabs,
  staffOptions,
}: ReportFiltersProps) {
  return (
    <div className="flex flex-col gap-4 px-5 pb-4 pt-4 md:px-6">
      <PeriodPicker
        period={view.period}
        day={view.day}
        hrefFor={(period, day) =>
          reportsHref(view, { period, day, range: null })
        }
        range={view.range ? <RangeRow view={view} /> : undefined}
      />
      <ReportTabs view={view} tabs={tabs} />
      {staffOptions && (
        <InvoiceStaffRow
          options={staffOptions}
          selectedId={view.staffId}
          hrefFor={(staffId) => reportsHref(view, { staffId })}
        />
      )}
    </div>
  );
}
