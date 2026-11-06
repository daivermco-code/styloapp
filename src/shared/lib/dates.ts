import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Toda la demo vive en hora de Bogotá, sin importar la zona del equipo que la abre.
// Es una constante (no una variable de entorno) para que el servidor y el navegador
// formateen igual y no haya diferencias al hidratar.
export const APP_TIMEZONE = "America/Bogota";

type DateInput = Date | string | number;

function inBogota(value: DateInput): TZDate {
  return new TZDate(new Date(value).getTime(), APP_TIMEZONE);
}

/** Día de hoy en Bogotá, como "2026-10-31". */
export function todayInBogota(now: DateInput = new Date()): string {
  return format(inBogota(now), "yyyy-MM-dd");
}

/** Hora como se dice en Colombia: "11:00 a. m.", "3:30 p. m.". */
export function formatTime(value: DateInput): string {
  const date = inBogota(value);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const suffix = hours < 12 ? "a. m." : "p. m.";
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12}:${minutes} ${suffix}`;
}

/** Fecha larga: "sábado, 31 de octubre de 2026". */
export function formatLongDate(value: DateInput): string {
  return format(inBogota(value), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
}

/** Fecha corta para tarjetas y carruseles: "sáb 31 oct". */
export function formatShortDate(value: DateInput): string {
  return format(inBogota(value), "EEE d MMM", { locale: es }).replaceAll(
    ".",
    "",
  );
}

/** Día y mes cortos, para "Pagada a Camilo el 1 nov": "1 nov". */
export function formatDayMonth(value: DateInput): string {
  return format(inBogota(value), "d MMM", { locale: es }).replaceAll(".", "");
}

/** Lo mismo para un día "YYYY-MM-DD" que ya es de Bogotá (fecha de un gasto o de un pago): "1 nov". */
export function formatDayOfMonth(day: string): string {
  return formatDayMonth(`${day}T12:00:00-05:00`);
}

/** Instante de un día y una hora de Bogotá: ("2026-10-31", "11:00") → Date. */
export function bogotaDateTime(day: string, time: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(
    new TZDate(year, month - 1, date, hours, minutes, APP_TIMEZONE).getTime(),
  );
}

/** Minutos que pasaron entre dos instantes (positivo si `later` es después). */
export function minutesBetween(earlier: DateInput, later: DateInput): number {
  return (new Date(later).getTime() - new Date(earlier).getTime()) / 60_000;
}

/** Un día "YYYY-MM-DD" movido `days` días: ("2026-10-31", 1) → "2026-11-01". */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days))
    .toISOString()
    .slice(0, 10);
}

/** Día de la semana de un día "YYYY-MM-DD" (0 = domingo, como `work_hours.weekday`). */
export function weekdayOf(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay();
}
