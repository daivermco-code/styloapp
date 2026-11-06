import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { getInvoiceStaffOptions } from "@/features/invoices/services/queries";
import type { InvoiceStaffOption } from "@/features/invoices/types/invoice";
import { CommissionsReport } from "@/features/reports/components/commissions-report";
import {
  Indicators,
  IndicatorsSkeleton,
} from "@/features/reports/components/indicators";
import { MethodsReport } from "@/features/reports/components/methods-report";
import { RangeSheet } from "@/features/reports/components/range-sheet";
import { ReportFilters } from "@/features/reports/components/report-filters";
import { ReportListSkeleton } from "@/features/reports/components/report-parts";
import { ServicesReport } from "@/features/reports/components/services-report";
import {
  parseReportView,
  REPORT_TABS,
  type ReportSearchParams,
  type ReportView,
  STAFF_REPORT_TABS,
} from "@/features/reports/lib/filters";
import { previousRange, reportRange } from "@/features/reports/lib/range";
import type { ReportArgs } from "@/features/reports/services/queries";
import { getMyStaff } from "@/features/team/services/queries";
import { TopBar } from "@/shared/components/top-bar";
import { todayInBogota } from "@/shared/lib/dates";
import { PendingArea } from "@/shared/components/instant-nav";
import { NAV_GROUP } from "@/shared/lib/instant-nav";

export const metadata: Metadata = { title: "Informes" };

/** La pestaña que se mira, con lo que pide a la base. */
function ReportBody({
  view,
  args,
  owner,
}: {
  view: ReportView;
  args: ReportArgs;
  owner: boolean;
}) {
  switch (view.tab) {
    case "ventas":
      return <ServicesReport args={args} />;
    case "comisiones":
      return <CommissionsReport args={args} />;
    case "metodos":
      return <MethodsReport args={args} />;
    default:
      return (
        <Indicators
          args={args}
          previous={previousRange(view)}
          side={owner ? "owner" : "staff"}
        />
      );
  }
}

// Informes del dueño y del profesional (T-13.1.2 y T-13.2.2, US-052 a US-057, Pantallas 19, 20 y
// 22). Lo que se mira va en la URL y se lee con Zod (?pestana=, ?periodo=, ?dia=, ?desde=,
// ?hasta= y ?pro=). El dueño tiene 4 pestañas y la fila de profesionales; el profesional, 3 y
// solo lo suyo: un ?pro= o ?pestana=metodos en su URL no le sirve, y la base lo repite.
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>;
}) {
  const person = await getCurrentPerson();
  if (!person) redirect("/entrar?siguiente=/pro/informes");
  const staff = await getMyStaff(person.id);
  // El proxy solo deja entrar a /pro a quien tiene una fila activa en staff (invariante 1).
  if (!staff) redirect("/pro");

  const owner = staff.role === "owner";
  const parsed = parseReportView(await searchParams, todayInBogota(), owner);
  const staffOptions: InvoiceStaffOption[] | null = owner
    ? await getInvoiceStaffOptions(staff.businessId)
    : null;
  // Un ?pro= que no es del equipo vuelve a "Todos".
  const view: ReportView = {
    ...parsed,
    staffId: staffOptions?.some((option) => option.id === parsed.staffId)
      ? parsed.staffId
      : null,
  };
  const range = reportRange(view);
  const args: ReportArgs = {
    businessId: staff.businessId,
    range,
    staffId: view.staffId,
  };

  return (
    <div className="flex min-h-dvh flex-col bg-soft">
      <TopBar
        title="Informes"
        backHref="/pro"
        actions={<RangeSheet view={view} />}
      />
      <div className="bg-surface">
        <div className="mx-auto w-full max-w-[960px]">
          <ReportFilters
            view={view}
            tabs={owner ? REPORT_TABS : STAFF_REPORT_TABS}
            staffOptions={staffOptions}
          />
        </div>
      </div>
      <main className="mx-auto w-full max-w-[960px] flex-1 px-4 py-4 md:px-6 md:py-6">
        {/* Mientras llega lo pedido, el esqueleto de la pestaña pedida: Indicadores si no trae
            ?pestana= (Fase 17). */}
        <PendingArea
          groups={[
            NAV_GROUP.period,
            NAV_GROUP.periodShift,
            NAV_GROUP.staff,
            NAV_GROUP.reportTabs,
            NAV_GROUP.reportRange,
          ]}
          fallback={<IndicatorsSkeleton />}
          byParam={{
            param: "pestana",
            fallbacks: {
              ventas: <ReportListSkeleton />,
              comisiones: <ReportListSkeleton />,
              metodos: <ReportListSkeleton />,
            },
          }}
        >
          <Suspense
            key={`${view.tab}-${range.from}-${range.to}-${view.staffId ?? "todos"}`}
            fallback={
              view.tab === "indicadores" ? (
                <IndicatorsSkeleton />
              ) : (
                <ReportListSkeleton />
              )
            }
          >
            <ReportBody view={view} args={args} owner={owner} />
          </Suspense>
        </PendingArea>
      </main>
    </div>
  );
}
