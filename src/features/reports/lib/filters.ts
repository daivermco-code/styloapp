import { parseDay } from "@/features/agenda/lib/grid";
import { parsePeriod } from "@/shared/lib/periods";
import { reportRangeSchema, reportStaffSchema } from "../types/schemas";
import type { ReportFilters } from "./range";

// Lo que se mira en Informes, todo en la URL para poder recargar y volver (Tech Spec O5.3,
// US-053): ?pestana=, ?periodo=&dia=, ?desde=&hasta= (el rango) y ?pro= (solo el dueño).

export const REPORT_TABS = [
  "indicadores",
  "ventas",
  "comisiones",
  "metodos",
] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

/** Las del profesional: sin Métodos de pago (US-057). */
export const STAFF_REPORT_TABS: readonly ReportTab[] = [
  "indicadores",
  "ventas",
  "comisiones",
];

export interface ReportView extends ReportFilters {
  tab: ReportTab;
  /** El profesional elegido por el dueño; null es "Todos". */
  staffId: string | null;
}

export interface ReportSearchParams {
  pestana?: string;
  periodo?: string;
  dia?: string;
  desde?: string;
  hasta?: string;
  pro?: string;
}

/**
 * Los parámetros de la URL. El periodo y el día van siempre, para que la "x" del rango vuelva a
 * ellos; con `desde` y `hasta`, la pantalla los ignora. La pestaña de siempre y "Todos" no se
 * escriben.
 */
export function reportsHrefParams(view: ReportView): URLSearchParams {
  const params = new URLSearchParams();
  if (view.tab !== "indicadores") params.set("pestana", view.tab);
  params.set("periodo", view.period);
  params.set("dia", view.day);
  if (view.range) {
    params.set("desde", view.range.from);
    params.set("hasta", view.range.to);
  }
  if (view.staffId) params.set("pro", view.staffId);
  return params;
}

/**
 * Lo que dice la URL; lo que no se entiende queda en el valor de siempre (Indicadores generales,
 * Día, hoy, sin rango y Todos). Un rango al revés o de más de un año no se toma. Al profesional
 * no le sirven ?pro= ni la pestaña Métodos de pago: ve lo suyo en Indicadores generales.
 */
export function parseReportView(
  params: ReportSearchParams,
  today: string,
  isOwner: boolean,
): ReportView {
  const tabs = isOwner ? REPORT_TABS : STAFF_REPORT_TABS;
  const range = reportRangeSchema.safeParse({
    from: params.desde,
    to: params.hasta,
  });
  const staff = reportStaffSchema.safeParse(params.pro);
  return {
    tab: tabs.find((tab) => tab === params.pestana) ?? "indicadores",
    period: parsePeriod(params.periodo) ?? "dia",
    day: parseDay(params.dia) ?? today,
    range: range.success ? range.data : null,
    staffId: isOwner && staff.success ? staff.data : null,
  };
}
