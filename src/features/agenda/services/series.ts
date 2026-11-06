import "server-only";
import { getWeekHours } from "@/features/business/services/queries";
import { createClient } from "@/lib/supabase/server";
import { addDays, bogotaDateTime, weekdayOf } from "@/shared/lib/dates";
import { effectiveRanges, type Weekday } from "../lib/hours";
import { type SeriesDateStatus, seriesDateStatus } from "../lib/recurring";
import type { SeriesDate } from "../types/agenda";

interface SeriesQuery {
  businessId: string;
  staffId: string;
  dates: string[];
  time: string;
  durationMinutes: number;
}

/**
 * Cómo queda cada fecha de una serie (US-022): libre, ocupada, fuera de horario o ya pasada. Lee
 * de una vez las citas activas y los bloqueos del profesional entre la primera y la última fecha
 * (el dueño los ve todos por RLS) y el horario de la semana.
 */
export async function classifySeries(
  query: SeriesQuery,
): Promise<SeriesDate[]> {
  const supabase = await createClient();
  const from = bogotaDateTime(query.dates[0], "00:00").toISOString();
  const to = bogotaDateTime(
    addDays(query.dates[query.dates.length - 1], 1),
    "00:00",
  ).toISOString();
  const [business, staff, bookings, blocks] = await Promise.all([
    getWeekHours(query.businessId, null),
    getWeekHours(query.businessId, query.staffId),
    supabase
      .from("bookings")
      .select("starts_at, ends_at")
      .eq("staff_id", query.staffId)
      .neq("status", "cancelled")
      .lt("starts_at", to)
      .gt("ends_at", from),
    supabase
      .from("agenda_blocks")
      .select("starts_at, ends_at")
      .eq("staff_id", query.staffId)
      .lt("starts_at", to)
      .gt("ends_at", from),
  ]);
  const busy = [...(bookings.data ?? []), ...(blocks.data ?? [])].map(
    (row) => ({ startsAt: row.starts_at, endsAt: row.ends_at }),
  );
  const now = new Date().toISOString();
  return query.dates.map((day) => {
    const weekday = weekdayOf(day) as Weekday;
    const status: SeriesDateStatus = seriesDateStatus({
      day,
      time: query.time,
      durationMinutes: query.durationMinutes,
      workRanges: effectiveRanges(business[weekday], staff[weekday]),
      busy,
      now,
    });
    return { day, status };
  });
}
