// Horas libres para una cita (US-017 y, desde la Fase 5, la reserva del cliente). Puro: recibe
// la hora actual como parámetro y sirve igual en el servidor y en el navegador. Los días van
// como "YYYY-MM-DD" y las horas como "HH:MM", siempre en hora de Bogotá (Tech Spec §5.2).
import { addDays, bogotaDateTime, todayInBogota } from "@/shared/lib/dates";
import { fromMinutes, type TimeRange, toMinutes } from "./hours";
import { type Interval, overlaps } from "./rules";

export type SlotInterval = 15 | 30 | 60;

export interface SlotQuery {
  /** "2026-10-31", en Bogotá. */
  day: string;
  /** Horario del profesional ese día (ya dentro del del negocio). */
  workRanges: TimeRange[];
  /** Citas activas y bloqueos de ese profesional (de `busy_ranges`). */
  busy: Interval[];
  durationMinutes: number;
  intervalMinutes: SlotInterval;
  /** Antelación mínima: no se reserva con menos de esto. */
  minNoticeMinutes: number;
  /** Hasta cuántos días adelante se reserva; null = sin límite. */
  maxAdvanceDays: number | null;
  /** Hora actual (ISO). */
  now: string;
}

/**
 * Horas de inicio libres ("HH:MM"), en orden. Cada franja ofrece una hora cada
 * `intervalMinutes` desde su inicio; una hora sale si la cita entera cabe en la franja, no se
 * cruza con nada ocupado y respeta la antelación mínima. Un día pasado o más allá de los días
 * máximos no tiene horas.
 */
export function availableSlots(query: SlotQuery): string[] {
  const today = todayInBogota(query.now);
  if (query.day < today) return [];
  if (
    query.maxAdvanceDays !== null &&
    query.day > addDays(today, query.maxAdvanceDays)
  ) {
    return [];
  }
  const earliest = Date.parse(query.now) + query.minNoticeMinutes * 60_000;
  const slots = new Set<string>();
  for (const range of query.workRanges) {
    const last = toMinutes(range.ends) - query.durationMinutes;
    for (
      let start = toMinutes(range.starts);
      start <= last;
      start += query.intervalMinutes
    ) {
      const clock = fromMinutes(start);
      const startsAt = bogotaDateTime(query.day, clock);
      if (startsAt.getTime() < earliest) continue;
      const slot = {
        startsAt: startsAt.toISOString(),
        endsAt: bookingEnd(startsAt.toISOString(), query.durationMinutes),
      };
      if (query.busy.some((busy) => overlaps(slot, busy))) continue;
      slots.add(clock);
    }
  }
  return [...slots].sort();
}

/** Fin de una cita (ISO) a partir de su inicio y su duración. */
export function bookingEnd(startsAt: string, durationMinutes: number): string {
  return new Date(
    Date.parse(startsAt) + durationMinutes * 60_000,
  ).toISOString();
}
