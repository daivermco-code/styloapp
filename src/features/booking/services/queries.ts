import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MyBooking } from "../types/booking";
import type { ClientProfile, Gender } from "../types/profile";

/**
 * Lo que dura un servicio con un profesional (su duración propia o la del servicio), o null si el
 * servicio está archivado, no es del negocio o el profesional no lo hace o no está activo.
 */
export async function clientServiceMinutes(
  businessId: string,
  staffId: string,
  serviceId: string,
): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_services")
    .select(
      "duration_minutes, services!inner(duration_minutes, is_active, business_id), staff!inner(is_active, business_id)",
    )
    .eq("staff_id", staffId)
    .eq("service_id", serviceId)
    .eq("services.business_id", businessId)
    .eq("services.is_active", true)
    .eq("staff.business_id", businessId)
    .eq("staff.is_active", true)
    .maybeSingle();
  if (!data) return null;
  return data.duration_minutes ?? data.services.duration_minutes;
}

const MY_BOOKING_COLUMNS =
  "id, starts_at, ends_at, status, punctuality, price, service_id, staff_id, services(name), staff(display_name), businesses(id, name, address, neighborhood, city, logo_url, cancel_limit_minutes), reviews(id), clients!inner(profile_id)";

/**
 * Las citas de quien tiene sesión como cliente, de la más reciente a la más vieja. La RLS ya deja
 * ver solo las de sus fichas; el filtro por su perfil deja fuera las de su propio negocio si
 * además es del equipo. `bookingId` trae una sola.
 */
export async function getMyBookings(bookingId?: string): Promise<MyBooking[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  let query = supabase
    .from("bookings")
    .select(MY_BOOKING_COLUMNS)
    .eq("clients.profile_id", user.id)
    .order("starts_at", { ascending: false });
  if (bookingId) query = query.eq("id", bookingId);
  const { data, error } = await query;
  if (error) {
    console.error("[getMyBookings]", error.code);
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    punctuality: row.punctuality,
    price: row.price,
    serviceId: row.service_id,
    serviceName: row.services.name,
    staffId: row.staff_id,
    staffName: row.staff.display_name,
    business: {
      id: row.businesses.id,
      name: row.businesses.name,
      address: row.businesses.address,
      neighborhood: row.businesses.neighborhood,
      city: row.businesses.city,
      logoUrl: row.businesses.logo_url,
      cancelLimitMinutes: row.businesses.cancel_limit_minutes,
    },
    reviewed: row.reviews !== null,
  }));
}

/**
 * Mis Reservas en sus dos pestañas (US-028). Actuales: las que no han terminado y nadie ha
 * marcado, de la más cercana a la más lejana. Historial: las demás, de la más nueva a la más vieja.
 */
export async function getMyBookingTabs(): Promise<{
  current: MyBooking[];
  history: MyBooking[];
}> {
  const bookings = await getMyBookings();
  const now = Date.now();
  const isCurrent = (booking: MyBooking) =>
    booking.status === "pending" && Date.parse(booking.endsAt) > now;
  return {
    current: bookings.filter(isCurrent).reverse(),
    history: bookings.filter((booking) => !isCurrent(booking)),
  };
}

/** El perfil de quien tiene sesión con sus cuatro interruptores (US-032), o null sin sesión. */
export async function getClientProfile(): Promise<ClientProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select(
      "full_name, gender, birth_date, share_phone_on_booking, share_phone_with_followed, whatsapp_booking_messages, whatsapp_promotions",
    )
    .eq("id", user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    fullName: data.full_name ?? "",
    gender: data.gender as Gender | null,
    birthDate: data.birth_date,
    preferences: {
      share_phone_on_booking: data.share_phone_on_booking,
      share_phone_with_followed: data.share_phone_with_followed,
      whatsapp_booking_messages: data.whatsapp_booking_messages,
      whatsapp_promotions: data.whatsapp_promotions,
    },
  };
}
