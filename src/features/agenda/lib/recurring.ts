// Citas recurrentes (US-022). Puro: los días van como "YYYY-MM-DD" y las horas como "HH:MM",
// en hora de Bogotá, y la hora actual llega como parámetro. Mensual (aprobado con el
// Blueprint): el mismo día del mes; si el mes no lo tiene, el último día.
import { addDays, bogotaDateTime } from "@/shared/lib/dates";
import { type TimeRange, toMinutes } from "./hours";
import { type Interval, overlaps } from "./rules";
import { bookingEnd } from "./slots";

export type RecurringFrequency = "weekly" | "biweekly" | "monthly";

/** Cómo queda cada fecha de la serie antes de crearla. */
export type SeriesDateStatus = "free" | "busy" | "closed" | "past";

const DAYS_APART = { weekly: 7, biweekly: 14 } as const;

const pad = (value: number) => String(value).padStart(2, "0");

/** El mismo día del mes `months` meses después, o el último día si ese mes no lo tiene. */
function addMonths(day: string, months: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const index = year * 12 + month - 1 + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  // El día 0 del mes siguiente es el último de este.
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  return `${nextYear}-${pad(nextMonth)}-${pad(Math.min(date, lastDay))}`;
}

/** Los días de una serie de `count` citas; la primera es `start`. */
export function recurringDates(
  start: string,
  frequency: RecurringFrequency,
  count: number,
): string[] {
  return Array.from({ length: count }, (_, index) =>
    frequency === "monthly"
      ? addMonths(start, index)
      : addDays(start, index * DAYS_APART[frequency]),
  );
}

export interface SeriesDateQuery {
  day: string;
  time: string;
  durationMinutes: number;
  /** Horario del profesional ese día (ya dentro del del negocio). */
  workRanges: TimeRange[];
  /** Citas activas y bloqueos del profesional. */
  busy: Interval[];
  /** Hora actual (ISO). */
  now: string;
}

/**
 * Si una fecha de la serie se puede crear: no ya pasó, la cita entera cabe en una franja del
 * horario y no se cruza con nada ocupado.
 */
export function seriesDateStatus(query: SeriesDateQuery): SeriesDateStatus {
  const startsAt = bogotaDateTime(query.day, query.time).toISOString();
  if (Date.parse(startsAt) < Date.parse(query.now)) return "past";
  const start = toMinutes(query.time);
  const end = start + query.durationMinutes;
  const fits = query.workRanges.some(
    (range) => toMinutes(range.starts) <= start && end <= toMinutes(range.ends),
  );
  if (!fits) return "closed";
  const slot = {
    startsAt,
    endsAt: bookingEnd(startsAt, query.durationMinutes),
  };
  return query.busy.some((item) => overlaps(slot, item)) ? "busy" : "free";
}

/**
 * Lo que se dice al crear la serie: "Se crearon 8 citas. 2 no, porque la hora estaba ocupada."
 * `busy` son las que encontraron la hora tomada; `closed`, las que caen fuera de horario o ya
 * pasaron.
 */
export function seriesSummary(
  created: number,
  busy: number,
  closed: number,
): string {
  const done =
    created === 1 ? "Se creó 1 cita." : `Se crearon ${created} citas.`;
  const missing = busy + closed;
  if (missing === 0) return done;
  const reason =
    closed === 0
      ? "la hora estaba ocupada"
      : busy === 0
        ? "caen fuera del horario"
        : "la hora estaba ocupada o fuera del horario";
  return `${done} ${missing} no, porque ${reason}.`;
}

// Agendas recurrentes (T-10.2.2, US-050): cómo se dice cada serie en su tarjeta.

const WEEKDAYS_PLURAL = [
  "domingos",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábados",
];

export interface SeriesRhythm {
  frequency: RecurringFrequency;
  /** 0 = domingo, como `recurring_bookings.weekday`. */
  weekday: number;
  /** "HH:MM" o "HH:MM:SS". */
  startTime: string;
  /** El primer día, "YYYY-MM-DD": en la mensual, el día del mes. */
  startsOn: string;
}

function clock(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12}:${pad(minutes)} ${hours < 12 ? "a. m." : "p. m."}`;
}

/** "Cada 15 días · sábados 10:00 a. m.", "Cada semana · martes …" o "Cada mes · el día 14, …". */
export function seriesRhythm(series: SeriesRhythm): string {
  const time = clock(series.startTime);
  if (series.frequency === "monthly") {
    return `Cada mes · el día ${Number(series.startsOn.slice(8))}, ${time}`;
  }
  const every = series.frequency === "weekly" ? "Cada semana" : "Cada 15 días";
  return `${every} · ${WEEKDAYS_PLURAL[series.weekday]} ${time}`;
}

/** "Quedan 6 citas", "Queda 1 cita" o "No le quedan citas". */
export function seriesLeft(left: number): string {
  if (left === 0) return "No le quedan citas";
  return left === 1 ? "Queda 1 cita" : `Quedan ${left} citas`;
}

/** Lo que dice la confirmación de "Eliminar serie". */
export function deleteSeriesWarning(left: number): string {
  const kept = "Las que ya pasaron se quedan.";
  if (left === 0) return `No le quedan citas por delante. ${kept}`;
  if (left === 1) return `Se cancela la cita que falta. ${kept}`;
  return `Se cancelan las ${left} citas que faltan. ${kept}`;
}
