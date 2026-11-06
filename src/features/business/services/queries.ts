import "server-only";
import { redirect } from "next/navigation";
import { rowsToWeek, type WeekHours } from "@/features/agenda/lib/hours";
import {
  type CurrentPerson,
  getCurrentPerson,
} from "@/features/auth/services/queries";
import { createClient } from "@/lib/supabase/server";
import type { BusinessFunctions, SlotInterval } from "../lib/functions";
import type { PaymentMethod } from "../types/payment";

export interface BusinessSettings extends BusinessFunctions {
  id: string;
  name: string;
  slug: string;
  address: string;
  neighborhood: string | null;
  city: string;
  whatsapp: string | null;
}

/**
 * Las pantallas de "Configurar negocio" son del dueño. El proxy ya devuelve al profesional a
 * /pro; esto lo repite en el servidor y entrega el negocio.
 */
export async function requireOwner(
  path: string,
): Promise<CurrentPerson & { business: { id: string; name: string } }> {
  const person = await getCurrentPerson();
  if (!person) redirect(`/entrar?siguiente=${encodeURIComponent(path)}`);
  if (person.side !== "owner" || !person.business) redirect("/pro");
  return { ...person, business: person.business };
}

export async function getBusinessSettings(
  businessId: string,
): Promise<BusinessSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select(
      "id, name, slug, address, neighborhood, city, whatsapp, online_booking, cancel_limit_minutes, slot_interval_minutes, min_notice_minutes, max_advance_days, show_owner_agenda",
    )
    .eq("id", businessId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    address: data.address,
    neighborhood: data.neighborhood,
    city: data.city,
    whatsapp: data.whatsapp,
    onlineBooking: data.online_booking,
    cancelLimitMinutes: data.cancel_limit_minutes,
    slotIntervalMinutes: data.slot_interval_minutes as SlotInterval,
    minNoticeMinutes: data.min_notice_minutes,
    maxAdvanceDays: data.max_advance_days,
    showOwnerAgenda: data.show_owner_agenda,
  };
}

/** La semana del negocio (staffId null) o de un profesional. */
export async function getWeekHours(
  businessId: string,
  staffId: string | null,
): Promise<WeekHours> {
  const supabase = await createClient();
  const query = supabase
    .from("work_hours")
    .select("weekday, starts, ends")
    .eq("business_id", businessId);
  const { data } = await (staffId
    ? query.eq("staff_id", staffId)
    : query.is("staff_id", null));
  return rowsToWeek(data ?? []);
}

/** Los métodos de pago del negocio en su orden, activos e inactivos (US-039). */
export async function getPaymentMethods(
  businessId: string,
): Promise<PaymentMethod[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_methods")
    .select("id, name, is_active")
    .eq("business_id", businessId)
    .order("position")
    .order("name");
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    isActive: row.is_active,
  }));
}
