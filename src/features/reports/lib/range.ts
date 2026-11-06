import { addDays } from "@/shared/lib/dates";
import { type Period, periodRange, shiftPeriod } from "@/shared/lib/periods";
import type { ReportRange } from "../types/report";

// El rango que mira cada informe y el de antes, para la variación (Tech Spec O5.4, PDR B.5).
// Trabajan con días "YYYY-MM-DD" de Bogotá; la semana va de lunes a domingo y la quincena del 1
// al 15 y del 16 al fin de mes, con periods.ts, como en Facturas.

/** El periodo y su día (lo que dicen los chips y las flechas) y, si hay, el rango propio. */
export interface ReportFilters {
  period: Period;
  day: string;
  /** "Filtrar: Rango"; mientras haya uno, manda sobre el periodo. */
  range: ReportRange | null;
}

const DAY_MS = 86_400_000;

function utcTime(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date);
}

/** Cuántos días tiene el rango, los dos extremos incluidos: del 1 al 15 → 15. */
export function daysInRange(range: ReportRange): number {
  return Math.round((utcTime(range.to) - utcTime(range.from)) / DAY_MS) + 1;
}

/** Lo que se mira: el rango propio o el periodo que contiene al día. */
export function reportRange(filters: ReportFilters): ReportRange {
  return filters.range ?? periodRange(filters.period, filters.day);
}

/**
 * Lo de antes, para la variación: el periodo anterior del mismo tipo (el día, la semana, la
 * quincena, el mes o el año de antes), o el rango del mismo largo justo antes del propio.
 */
export function previousRange(filters: ReportFilters): ReportRange {
  if (filters.range) {
    const length = daysInRange(filters.range);
    return {
      from: addDays(filters.range.from, -length),
      to: addDays(filters.range.from, -1),
    };
  }
  return periodRange(
    filters.period,
    shiftPeriod(filters.period, filters.day, -1),
  );
}
