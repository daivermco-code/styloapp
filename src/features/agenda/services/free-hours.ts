import "server-only";
import {
  getBusinessSettings,
  getWeekHours,
} from "@/features/business/services/queries";
import { createClient } from "@/lib/supabase/server";
import { weekdayOf } from "@/shared/lib/dates";
import { effectiveRanges, type Weekday } from "../lib/hours";
import { availableSlots } from "../lib/slots";

interface FreeHoursQuery {
  businessId: string;
  staffId: string;
  day: string;
  durationMinutes: number;
  /** La cita que se está modificando: su hora cuenta como libre. */
  exceptId: string | null;
  /**
   * La reserva en línea del cliente (Fase 5): con la antelación mínima y los días máximos del
   * negocio, y sin horas si el negocio no la recibe.
   */
  online?: boolean;
}

/**
 * Horas libres de un profesional un día (US-017 y US-027): dentro de su horario y del negocio, sin
 * citas activas ni bloqueos y sin horas pasadas. La antelación mínima y los días máximos son de la
 * reserva en línea: cuentan solo con `online`. La usan la fila de horas y, otra vez, las acciones
 * de crear y modificar del negocio.
 */
export async function computeFreeHours(
  query: FreeHoursQuery,
): Promise<string[]> {
  const supabase = await createClient();
  const weekday = weekdayOf(query.day) as Weekday;
  const [settings, business, staff, busy] = await Promise.all([
    getBusinessSettings(query.businessId),
    getWeekHours(query.businessId, null),
    getWeekHours(query.businessId, query.staffId),
    supabase.rpc("busy_ranges", {
      p_staff: query.staffId,
      p_day: query.day,
      ...(query.exceptId ? { p_except: query.exceptId } : {}),
    }),
  ]);
  if (!settings || busy.error) return [];
  if (query.online && !settings.onlineBooking) return [];
  return availableSlots({
    day: query.day,
    workRanges: effectiveRanges(business[weekday], staff[weekday]),
    busy: busy.data.map((row) => ({
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    })),
    durationMinutes: query.durationMinutes,
    intervalMinutes: settings.slotIntervalMinutes,
    minNoticeMinutes: query.online ? settings.minNoticeMinutes : 0,
    maxAdvanceDays: query.online ? settings.maxAdvanceDays : null,
    now: new Date().toISOString(),
  });
}

/** El precio de la cita: el propio del profesional o el del servicio. Null si no lo hace. */
export async function servicePriceFor(
  businessId: string,
  staffId: string,
  serviceId: string,
): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_services")
    .select("price, services!inner(price, is_active, business_id)")
    .eq("staff_id", staffId)
    .eq("service_id", serviceId)
    .eq("services.business_id", businessId)
    .eq("services.is_active", true)
    .maybeSingle();
  if (!data) return null;
  return data.price ?? data.services.price;
}
