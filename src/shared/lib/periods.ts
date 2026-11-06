import { addDays, weekdayOf } from "./dates";

// Periodos de Facturas, Gastos y el liquidador (T-8.1.1, US-042 y US-044). Trabajan con días
// "YYYY-MM-DD" que ya son de Bogotá (todayInBogota), así que no miran zonas horarias: la semana va
// de lunes a domingo y la quincena del 1 al 15 y del 16 al fin de mes (Tech Spec O4.4).

export const PERIODS = ["dia", "semana", "quincena", "mes", "ano"] as const;
export type Period = (typeof PERIODS)[number];

/** Los de Gastos: Día, Semana y Mes (UI A.1). */
export const EXPENSE_PERIODS: readonly Period[] = ["dia", "semana", "mes"];

export const PERIOD_NAMES: Record<Period, string> = {
  dia: "Día",
  semana: "Semana",
  quincena: "Quincena",
  mes: "Mes",
  ano: "Año",
};

/** Del primer al último día del periodo, los dos incluidos. */
export interface PeriodRange {
  from: string;
  to: string;
}

/** Los meses en minúscula, de enero (0) a diciembre (11). */
export const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

function parts(day: string): [number, number, number] {
  const [year, month, date] = day.split("-").map(Number);
  return [year, month, date];
}

/** (2026, 11, 1) → "2026-11-01". El mes va de 1 a 12. */
function isoDay(year: number, month: number, date: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

function lastDateOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** El periodo que contiene a `day`: ("semana", "2026-11-01") → del 26 de octubre al 1 de noviembre. */
export function periodRange(period: Period, day: string): PeriodRange {
  const [year, month, date] = parts(day);
  const last = isoDay(year, month, lastDateOfMonth(year, month));
  switch (period) {
    case "dia":
      return { from: day, to: day };
    case "semana": {
      const from = addDays(day, -((weekdayOf(day) + 6) % 7));
      return { from, to: addDays(from, 6) };
    }
    case "quincena":
      return date <= 15
        ? { from: isoDay(year, month, 1), to: isoDay(year, month, 15) }
        : { from: isoDay(year, month, 16), to: last };
    case "mes":
      return { from: isoDay(year, month, 1), to: last };
    case "ano":
      return { from: isoDay(year, 1, 1), to: isoDay(year, 12, 31) };
  }
}

/** El primer día del periodo anterior (-1) o del siguiente (1): lo que hacen las flechas. */
export function shiftPeriod(
  period: Period,
  day: string,
  direction: -1 | 1,
): string {
  const { from, to } = periodRange(period, day);
  return direction === 1
    ? addDays(to, 1)
    : periodRange(period, addDays(from, -1)).from;
}

function dayText(day: string): string {
  const [year, month, date] = parts(day);
  return `${date} de ${MONTH_NAMES[month - 1]} de ${year}`;
}

/** "del 2 al 8 de noviembre de 2026", sin repetir el mes ni el año cuando son los mismos. */
function spanText(from: string, to: string): string {
  const [fromYear, fromMonth, fromDate] = parts(from);
  const [toYear, toMonth, toDate] = parts(to);
  if (fromYear !== toYear) return `del ${dayText(from)} al ${dayText(to)}`;
  const tail = `${toDate} de ${MONTH_NAMES[toMonth - 1]} de ${toYear}`;
  return fromMonth === toMonth
    ? `del ${fromDate} al ${tail}`
    : `del ${fromDate} de ${MONTH_NAMES[fromMonth - 1]} al ${tail}`;
}

/** La fecha escrita del selector: "Día: domingo, 1 de noviembre de 2026", "Mes: noviembre de 2026". */
export function periodLabel(period: Period, day: string): string {
  const [year, month] = parts(day);
  const name = PERIOD_NAMES[period];
  switch (period) {
    case "dia":
      return `${name}: ${WEEKDAYS[weekdayOf(day)]}, ${dayText(day)}`;
    case "mes":
      return `${name}: ${MONTH_NAMES[month - 1]} de ${year}`;
    case "ano":
      return `${name}: ${year}`;
    default: {
      const { from, to } = periodRange(period, day);
      return `${name}: ${spanText(from, to)}`;
    }
  }
}

/** El periodo de la URL (?periodo=), o null si no es uno de los permitidos. */
export function parsePeriod(
  value: string | undefined,
  allowed: readonly Period[] = PERIODS,
): Period | null {
  return allowed.find((period) => period === value) ?? null;
}
