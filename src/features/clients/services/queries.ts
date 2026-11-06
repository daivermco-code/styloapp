import "server-only";
import { GENDERS } from "@/features/auth/types/schemas";
import { createClient } from "@/lib/supabase/server";
import type { ClientStat } from "../lib/tabs";
import type {
  ClientBooking,
  ClientInvoice,
  ClientProfile,
} from "../types/client";

// Clientes del dueño (US-047). `client_stats` solo responde al dueño del negocio; al profesional
// le da una lista vacía, y la página ya lo manda al inicio con requireOwner.

/** Las fichas del negocio con sus números, de la A a la Z. */
export async function getClientStats(
  businessId: string,
): Promise<ClientStat[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_stats", {
    p_business: businessId,
  });
  if (error) {
    console.error("[getClientStats]", error.code);
    throw new Error("No se pudieron cargar los clientes.");
  }
  // Los tipos generados dicen que nada llega en null, pero el celular, la fecha y los días de
  // la última visita sí pueden llegar así.
  return (data ?? []).map((row) => {
    const daysAway = row.days_away as number | null;
    return {
      id: row.client_id,
      fullName: row.full_name,
      phone: (row.phone as string | null) ?? null,
      birthDate: (row.birth_date as string | null) ?? null,
      visits: Number(row.visits),
      daysAway: daysAway === null ? null : Number(daysAway),
      invoiced: Number(row.invoiced),
      hasAccount: row.has_account,
      isBlocked: row.is_blocked,
    };
  });
}

const PROFILE_COLUMNS =
  "id, full_name, birth_date, gender, whatsapp_ok, promos_ok, is_blocked, profile_id";

/** La ficha de un cliente del negocio, o null si no existe o es de otro. El celular y las notas, aparte. */
export async function getClientProfile(
  businessId: string,
  clientId: string,
): Promise<ClientProfile | null> {
  const supabase = await createClient();
  // El celular y las notas no están en el permiso de lectura de la tabla: salen de client_phone(),
  // que da null si el cliente con cuenta no lo comparte, y de client_notes(), solo para el dueño.
  const { data } = await supabase
    .from("clients")
    .select(PROFILE_COLUMNS)
    .eq("business_id", businessId)
    .eq("id", clientId)
    .maybeSingle();
  if (!data) return null;
  const [phone, notes, reputation] = await Promise.all([
    supabase.rpc("client_phone", { p_client: data.id }),
    supabase.rpc("client_notes", { p_client: data.id }),
    data.profile_id
      ? supabase.rpc("client_reputation", { p_profile: data.profile_id })
      : null,
  ]);
  // Sin las notas, el editor las mostraría vacías y al guardar las borraría.
  if (notes.error) {
    console.error("[getClientProfile]", notes.error.code);
    throw new Error("No se pudo cargar la ficha del cliente.");
  }
  const rated = reputation?.data?.[0];
  return {
    id: data.id,
    fullName: data.full_name,
    phone: phone.data ?? null,
    birthDate: data.birth_date,
    gender: GENDERS.find((gender) => gender === data.gender) ?? null,
    notes: notes.data ?? null,
    whatsappOk: data.whatsapp_ok,
    promosOk: data.promos_ok,
    isBlocked: data.is_blocked,
    hasAccount: data.profile_id !== null,
    reputation:
      rated && rated.rated_bookings > 0
        ? { score: Number(rated.score), count: Number(rated.rated_bookings) }
        : null,
  };
}

/** Las citas del cliente, de la más nueva a la más vieja. */
export async function getClientBookings(
  businessId: string,
  clientId: string,
): Promise<ClientBooking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, starts_at, status, services(name), staff(display_name)")
    .eq("business_id", businessId)
    .eq("client_id", clientId)
    .order("starts_at", { ascending: false });
  if (error) {
    console.error("[getClientBookings]", error.code);
    throw new Error("No se pudieron cargar las citas del cliente.");
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    status: row.status,
    serviceName: row.services?.name ?? "",
    staffName: row.staff?.display_name ?? "",
  }));
}

/** Las facturas del cliente, pagadas y anuladas, de la más nueva a la más vieja. */
export async function getClientInvoices(
  businessId: string,
  clientId: string,
): Promise<ClientInvoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, number, status, issued_on, total, invoice_items(position, services(name))",
    )
    .eq("business_id", businessId)
    .eq("client_id", clientId)
    .order("issued_on", { ascending: false })
    .order("number", { ascending: false })
    .order("position", { referencedTable: "invoice_items" });
  if (error) {
    console.error("[getClientInvoices]", error.code);
    throw new Error("No se pudieron cargar las facturas del cliente.");
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    issuedOn: row.issued_on,
    total: row.total,
    services: row.invoice_items
      .map((item) => item.services?.name)
      .filter((name): name is string => !!name),
  }));
}
