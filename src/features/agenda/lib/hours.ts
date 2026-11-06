// Horarios por día (US-009, US-013 y US-014). Las horas van como "HH:MM" en hora de Bogotá; la
// base las guarda como `time` ("09:00:00"). Todo aquí es puro: sirve en el servidor y en el
// navegador, y lo usan el editor de horario y, desde la Fase 3, las horas libres.

export interface TimeRange {
  /** "09:00" */
  starts: string;
  /** "19:00" */
  ends: string;
}

/** 0 = domingo, como `work_hours.weekday` y `Date.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type WeekHours = Record<Weekday, TimeRange[]>;

/** La semana como se lee en Colombia: de lunes a domingo. */
export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

export const END_BEFORE_START = "La hora final debe ser después de la inicial.";
export const RANGES_OVERLAP = "Estas franjas se cruzan. Ajusta una.";
// El horario del profesional queda dentro del del negocio (US-013 y US-014): un texto para el
// dueño y otro para el profesional.
export const OUTSIDE_BUSINESS =
  "Esta franja queda fuera del horario del negocio.";
export const OUTSIDE_BUSINESS_SELF =
  "Tu horario debe quedar dentro del horario del negocio.";

const MINUTES_PER_DAY = 24 * 60;

/** "09:30" (o "09:30:00") → 570. */
export function toMinutes(clock: string): number {
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}

/** 570 → "09:30". */
export function fromMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** "13:30" → "1:30 p. m.", como se dice en Colombia. */
export function formatClock(clock: string): string {
  const total = toMinutes(clock);
  const hours = Math.floor(total / 60);
  const minutes = String(total % 60).padStart(2, "0");
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12}:${minutes} ${hours < 12 ? "a. m." : "p. m."}`;
}

/** Las horas que se pueden elegir en el editor: de 00:00 a 23:45, cada `step` minutos. */
export function clockOptions(step = 15): string[] {
  const options: string[] = [];
  for (let total = 0; total < MINUTES_PER_DAY; total += step) {
    options.push(fromMinutes(total));
  }
  return options;
}

export function emptyWeek(): WeekHours {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
}

function byStart(a: TimeRange, b: TimeRange): number {
  return toMinutes(a.starts) - toMinutes(b.starts);
}

/** Filas de `work_hours` → la semana, con las franjas de cada día en orden. */
export function rowsToWeek(
  rows: { weekday: number; starts: string; ends: string }[],
): WeekHours {
  const week = emptyWeek();
  for (const row of rows) {
    week[row.weekday as Weekday].push({
      starts: row.starts.slice(0, 5),
      ends: row.ends.slice(0, 5),
    });
  }
  for (const day of WEEK_ORDER) week[day].sort(byStart);
  return week;
}

/**
 * El primer problema de las franjas de un día, o null si están bien: una que termina antes de
 * empezar, o dos que se cruzan (tocarse en el borde, 13:00–14:00 y 14:00–19:00, sí vale).
 */
export function findRangeError(ranges: TimeRange[]): string | null {
  if (
    ranges.some((range) => toMinutes(range.ends) <= toMinutes(range.starts))
  ) {
    return END_BEFORE_START;
  }
  const sorted = [...ranges].sort(byStart);
  for (let index = 1; index < sorted.length; index += 1) {
    if (toMinutes(sorted[index].starts) < toMinutes(sorted[index - 1].ends)) {
      return RANGES_OVERLAP;
    }
  }
  return null;
}

/**
 * Las horas en que de verdad atiende un profesional un día: el cruce de las franjas del negocio
 * y las suyas (US-009: si el negocio cierra antes, esas horas dejan de ofrecerse).
 */
export function effectiveRanges(
  business: TimeRange[],
  staff: TimeRange[],
): TimeRange[] {
  const result: TimeRange[] = [];
  for (const own of staff) {
    for (const open of business) {
      const starts = Math.max(toMinutes(own.starts), toMinutes(open.starts));
      const ends = Math.min(toMinutes(own.ends), toMinutes(open.ends));
      if (ends > starts) {
        result.push({ starts: fromMinutes(starts), ends: fromMinutes(ends) });
      }
    }
  }
  return result.sort(byStart);
}

/**
 * Si cada franja del profesional cabe entera en el horario del negocio de ese día. Las franjas
 * del negocio que se tocan cuentan como una sola (9:00–13:00 y 13:00–19:00 dejan 10:00–15:00).
 */
export function fitsWithin(
  ranges: TimeRange[],
  business: TimeRange[],
): boolean {
  const open: TimeRange[] = [];
  for (const range of [...business].sort(byStart)) {
    const last = open.at(-1);
    if (last && toMinutes(range.starts) <= toMinutes(last.ends)) {
      if (toMinutes(range.ends) > toMinutes(last.ends)) last.ends = range.ends;
    } else {
      open.push({ ...range });
    }
  }
  return ranges.every((range) =>
    open.some(
      (block) =>
        toMinutes(block.starts) <= toMinutes(range.starts) &&
        toMinutes(range.ends) <= toMinutes(block.ends),
    ),
  );
}

/** Una franja nueva para "Agregar franja": una hora después de la última, de cuatro horas. */
export function nextRange(ranges: TimeRange[]): TimeRange {
  const last = [...ranges].sort(byStart).at(-1);
  if (!last) return { starts: "09:00", ends: "18:00" };
  const latest = MINUTES_PER_DAY - 15;
  const starts = Math.min(toMinutes(last.ends) + 60, latest - 15);
  const ends = Math.min(starts + 4 * 60, latest);
  return { starts: fromMinutes(starts), ends: fromMinutes(ends) };
}
