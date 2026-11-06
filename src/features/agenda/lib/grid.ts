// Medidas y cuentas de la grilla de la agenda (US-015 y US-016). Puro: los días van como
// "YYYY-MM-DD" y los minutos se cuentan desde la medianoche de Bogotá de ese día.
import { bogotaDateTime, minutesBetween } from "@/shared/lib/dates";
import { type TimeRange, toMinutes } from "./hours";
import type { Interval } from "./rules";

/** Alto de un cuarto de hora (medido contra la captura 11: 120 px por hora). */
export const QUARTER_PX = 30;
export const PX_PER_MINUTE = QUARTER_PX / 15;

const MINUTES_PER_DAY = 24 * 60;

/** Desde y hasta dónde va la grilla, en minutos desde la medianoche. */
export interface GridRange {
  start: number;
  end: number;
}

/** El primer año que se acepta: Date.UTC pasa los años 0 a 99 a 1900–1999, y Postgres no tiene año 0. */
const MIN_YEAR = 1900;

/** "2026-11-01" si es un día de verdad; si no, null (para leer `?dia=` de la URL). */
export function parseDay(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, date] = value.split("-").map(Number);
  if (year < MIN_YEAR) return null;
  const check = new Date(Date.UTC(year, month - 1, date));
  return check.getUTCMonth() === month - 1 && check.getUTCDate() === date
    ? value
    : null;
}

/** Minutos desde la medianoche de Bogotá de `day` hasta el instante (negativo si es antes). */
export function minuteOfDay(iso: string, day: string): number {
  return minutesBetween(bogotaDateTime(day, "00:00"), iso);
}

/**
 * La grilla va en horas enteras, del menor entre la apertura del negocio y lo primero del día
 * hasta el mayor entre el cierre y lo último, sin salirse del día. Así una cita fuera del horario
 * también se ve. Null si el negocio no atiende ese día y no hay nada.
 */
export function gridRange(
  day: string,
  openRanges: TimeRange[],
  items: Interval[],
): GridRange | null {
  const starts = [
    ...openRanges.map((range) => toMinutes(range.starts)),
    ...items.map((item) => minuteOfDay(item.startsAt, day)),
  ];
  const ends = [
    ...openRanges.map((range) => toMinutes(range.ends)),
    ...items.map((item) => minuteOfDay(item.endsAt, day)),
  ];
  if (starts.length === 0) return null;
  return {
    start: Math.max(0, Math.floor(Math.min(...starts) / 60) * 60),
    end: Math.min(MINUTES_PER_DAY, Math.ceil(Math.max(...ends) / 60) * 60),
  };
}

/** El cuarto de hora (minutos desde la medianoche) que cae a `offsetPx` del borde de la grilla. */
export function quarterAt(range: GridRange, offsetPx: number): number {
  const quarter = range.start + Math.floor(offsetPx / QUARTER_PX) * 15;
  return Math.min(Math.max(quarter, range.start), range.end - 15);
}

/**
 * Dónde y de qué alto se pinta algo en la grilla, recortado al rango. Deja 1 px arriba y abajo
 * para que dos citas seguidas no se vean pegadas.
 */
export function placeInGrid(
  range: GridRange,
  item: Interval,
  day: string,
): { top: number; height: number } {
  const start = Math.max(minuteOfDay(item.startsAt, day), range.start);
  const end = Math.min(minuteOfDay(item.endsAt, day), range.end);
  return {
    top: (start - range.start) * PX_PER_MINUTE + 1,
    height: Math.max((end - start) * PX_PER_MINUTE - 2, 0),
  };
}
