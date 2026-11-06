import "server-only";
import type { CurrentPerson } from "@/features/auth/services/queries";
import {
  getBusinessSettings,
  getWeekHours,
} from "@/features/business/services/queries";
import { formatServicePrice } from "@/features/catalog/lib/price";
import { getCatalog } from "@/features/catalog/services/queries";
import { getMyStaff } from "@/features/team/services/queries";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  bogotaDateTime,
  minutesBetween,
  todayInBogota,
  weekdayOf,
} from "@/shared/lib/dates";
import { gridRange, minuteOfDay } from "../lib/grid";
import { fromMinutes, type Weekday } from "../lib/hours";
import {
  LOCKED_CLIENT,
  LOCKED_NO_PERMISSION,
  LOCKED_STARTED,
} from "../types/messages";
import type {
  AgendaBlock,
  AgendaBooking,
  AgendaClient,
  AgendaColumn,
  AgendaDay,
  AgendaViewer,
  BookingCategoryOption,
  BookingDetail,
  EditableBooking,
} from "../types/agenda";

export const NO_CLIENT = "Sin cliente";

/** Quién mira la agenda y si puede agendar. Null si la persona no está en un negocio. */
export async function getAgendaViewer(
  person: CurrentPerson,
): Promise<AgendaViewer | null> {
  const staff = await getMyStaff(person.id);
  if (!staff) return null;
  const base = { businessId: staff.businessId, staffId: staff.id };
  if (staff.role === "owner") {
    return {
      ...base,
      side: "owner",
      canBook: true,
      canCreateClients: true,
      canBlock: true,
      canInvoice: true,
    };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_permissions")
    .select("manual_booking, internal_clients, manual_block, invoicing")
    .eq("business_id", staff.businessId)
    .maybeSingle();
  return {
    ...base,
    side: "staff",
    canBook: data?.manual_booking ?? false,
    canCreateClients: data?.internal_clients ?? false,
    canBlock: data?.manual_block ?? false,
    canInvoice: data?.invoicing ?? false,
  };
}

/**
 * La agenda de un día en hora de Bogotá (T-3.3.1): las columnas que la persona puede ver, sus
 * citas sin las canceladas y sus bloqueos. El dueño ve a todo el equipo activo (él mismo, si
 * `show_owner_agenda` está encendido o tiene algo ese día); el profesional, solo lo suyo. La RLS
 * repite el mismo límite en la base.
 */
export async function getAgendaDay(
  viewer: AgendaViewer,
  day: string,
): Promise<AgendaDay> {
  const supabase = await createClient();
  const from = bogotaDateTime(day, "00:00").toISOString();
  const to = bogotaDateTime(addDays(day, 1), "00:00").toISOString();
  const own = viewer.side === "staff";

  const bookingsQuery = supabase
    .from("bookings")
    .select(
      "id, staff_id, starts_at, ends_at, status, booked_by, guest_name, clients(full_name), services(name)",
    )
    .eq("business_id", viewer.businessId)
    .neq("status", "cancelled")
    .lt("starts_at", to)
    .gt("ends_at", from)
    .order("starts_at");
  const blocksQuery = supabase
    .from("agenda_blocks")
    .select("id, staff_id, starts_at, ends_at")
    .eq("business_id", viewer.businessId)
    .lt("starts_at", to)
    .gt("ends_at", from)
    .order("starts_at");

  const [staffResult, bookingsResult, blocksResult, settings, week] =
    await Promise.all([
      supabase
        .from("staff")
        .select("id, display_name, role")
        .eq("business_id", viewer.businessId)
        .eq("is_active", true)
        .order("position")
        .order("display_name"),
      own ? bookingsQuery.eq("staff_id", viewer.staffId) : bookingsQuery,
      own ? blocksQuery.eq("staff_id", viewer.staffId) : blocksQuery,
      getBusinessSettings(viewer.businessId),
      getWeekHours(viewer.businessId, null),
    ]);

  const bookings: AgendaBooking[] = (bookingsResult.data ?? []).map((row) => ({
    id: row.id,
    staffId: row.staff_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    bookedBy: row.booked_by,
    clientName: row.clients?.full_name ?? row.guest_name ?? NO_CLIENT,
    serviceName: row.services?.name ?? "",
  }));
  const blocks: AgendaBlock[] = (blocksResult.data ?? []).map((row) => ({
    id: row.id,
    staffId: row.staff_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  }));

  const busy = new Set([...bookings, ...blocks].map((item) => item.staffId));
  const columns: AgendaColumn[] = (staffResult.data ?? [])
    .filter((row) =>
      own
        ? row.id === viewer.staffId
        : row.role !== "owner" ||
          (settings?.showOwnerAgenda ?? true) ||
          busy.has(row.id),
    )
    .map((row) => ({
      id: row.id,
      name: row.display_name,
      isOwner: row.role === "owner",
    }))
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner));

  return {
    day,
    columns,
    bookings,
    blocks,
    range: gridRange(day, week[weekdayOf(day) as Weekday], [
      ...bookings,
      ...blocks,
    ]),
  };
}

/**
 * Los servicios activos que se pueden agendar, por categoría, cada uno con quién lo hace (su
 * duración y su precio propios). El profesional solo se ve a sí mismo; el dueño sale si
 * `show_owner_agenda` está encendido. Un servicio que nadie hace no sale. La app de clientes lo
 * pide con `side: "owner"`: el negocio entero (Fase 5).
 */
export async function getBookingCatalog(
  viewer: Pick<AgendaViewer, "businessId" | "side" | "staffId">,
): Promise<BookingCategoryOption[]> {
  const supabase = await createClient();
  const [catalog, settings, { data: staff }] = await Promise.all([
    getCatalog(viewer.businessId),
    getBusinessSettings(viewer.businessId),
    supabase
      .from("staff")
      .select(
        "id, display_name, role, staff_services(service_id, duration_minutes, price)",
      )
      .eq("business_id", viewer.businessId)
      .eq("is_active", true)
      .order("position")
      .order("display_name"),
  ]);
  const visible = (staff ?? [])
    .filter((row) =>
      viewer.side === "staff"
        ? row.id === viewer.staffId
        : row.role !== "owner" || (settings?.showOwnerAgenda ?? true),
    )
    .sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));

  return catalog
    .map((category) => ({
      id: category.id,
      name: category.name,
      services: category.services
        .filter((service) => service.isActive)
        .map((service) => ({
          id: service.id,
          name: service.name,
          priceLabel: formatServicePrice(service),
          durationMinutes: service.durationMinutes,
          staff: visible.flatMap((row) => {
            const own = row.staff_services.find(
              (item) => item.service_id === service.id,
            );
            return own
              ? [
                  {
                    id: row.id,
                    name: row.display_name,
                    durationMinutes:
                      own.duration_minutes ?? service.durationMinutes,
                    price: own.price ?? service.price,
                  },
                ]
              : [];
          }),
        }))
        .filter((service) => service.staff.length > 0),
    }))
    .filter((category) => category.services.length > 0);
}

/** Las fichas de clientes del negocio para el buscador del editor (`business_clients`). */
export async function getBusinessClients(
  businessId: string,
): Promise<AgendaClient[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("business_clients", {
    p_business: businessId,
  });
  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    hasAccount: row.has_account,
    isBlocked: row.is_blocked,
  }));
}

/**
 * Una cita para modificarla en el editor, o null si no existe, no se puede leer o ya está
 * cancelada. Lo demás que no deja cambiar lo explica el detalle (US-018) y lo repite la base.
 */
export async function getEditableBooking(
  bookingId: string,
): Promise<EditableBooking | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, staff_id, service_id, starts_at, ends_at, status, client_id, guest_name, clients(full_name)",
    )
    .eq("id", bookingId)
    .neq("status", "cancelled")
    .maybeSingle();
  if (!data) return null;
  const day = todayInBogota(data.starts_at);
  return {
    id: data.id,
    staffId: data.staff_id,
    serviceId: data.service_id,
    day,
    time: fromMinutes(minuteOfDay(data.starts_at, day)),
    durationMinutes: minutesBetween(data.starts_at, data.ends_at),
    clientId: data.client_id,
    clientName: data.clients?.full_name ?? data.guest_name ?? NO_CLIENT,
    guestName: data.guest_name,
  };
}

/** Por qué no sale Modificar o Cancelar en el detalle (US-018), en el orden en que pesa. */
function lockedReason(
  viewer: AgendaViewer,
  started: boolean,
  fromClient: boolean,
): string | null {
  if (!viewer.canBook) return LOCKED_NO_PERMISSION;
  if (started) return LOCKED_STARTED;
  if (fromClient) return LOCKED_CLIENT;
  return null;
}

/**
 * El detalle de una cita para la ventana de la agenda (T-3.5.1): sus datos, el celular del
 * cliente si quien mira puede verlo y la reputación con `client_reputation` (nunca sumando citas:
 * con RLS cada negocio vería otro promedio). Null si no existe o no la puede leer.
 */
export async function getBookingDetail(
  viewer: AgendaViewer,
  bookingId: string,
): Promise<BookingDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, client_id, recurring_id, starts_at, ends_at, status, booked_by, guest_name, price, note, punctuality, clients(full_name, profile_id, is_blocked), services(name), staff(display_name)",
    )
    .eq("id", bookingId)
    .eq("business_id", viewer.businessId)
    .maybeSingle();
  if (!data) return null;

  const profileId = data.clients?.profile_id ?? null;
  const [phone, reputation, invoice, invoiced] = await Promise.all([
    data.client_id
      ? supabase.rpc("client_phone", { p_client: data.client_id })
      : null,
    profileId
      ? supabase.rpc("client_reputation", { p_profile: profileId })
      : null,
    // A lo sumo una pagada por cita (uq_invoices_paid_booking); la anulada se puede rehacer.
    supabase
      .from("invoices")
      .select("id, number")
      .eq("booking_id", data.id)
      .eq("status", "paid")
      .maybeSingle(),
    // Si la RLS se la esconde (el dueño la facturó solo con servicios de otro), la base dice solo
    // si existe. El dueño ve todas: no hace falta preguntar.
    viewer.side === "owner"
      ? null
      : supabase.rpc("booking_is_invoiced", { p_booking: data.id }),
  ]);
  const rated = reputation?.data?.[0];
  const started = Date.parse(data.starts_at) <= Date.now();
  const active = data.status !== "cancelled";
  const fromClient = data.booked_by === "client";
  return {
    id: data.id,
    day: todayInBogota(data.starts_at),
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    status: data.status,
    bookedBy: data.booked_by,
    clientName: data.clients?.full_name ?? data.guest_name ?? NO_CLIENT,
    serviceName: data.services?.name ?? "",
    staffName: data.staff?.display_name ?? "",
    price: data.price,
    note: data.note,
    punctuality: data.punctuality,
    clientPhone: phone?.data ?? null,
    reputation:
      rated && rated.rated_bookings > 0
        ? { score: Number(rated.score), count: rated.rated_bookings }
        : null,
    started,
    canModify: active && viewer.canBook && !started && !fromClient,
    canCancel: active && viewer.canBook && !started,
    lockedReason: active ? lockedReason(viewer, started, fromClient) : null,
    clientId: data.client_id,
    clientBlocked: data.clients?.is_blocked ?? false,
    canBlockClient: viewer.side === "owner" && fromClient && !!data.client_id,
    inSeries: data.recurring_id !== null,
    canInvoice: viewer.canInvoice,
    invoice: invoice.data ?? null,
    invoiced: invoice.data !== null || invoiced?.data === true,
  };
}
