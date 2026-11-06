import "server-only";
import { getCatalog } from "@/features/catalog/services/queries";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_COMMISSION } from "../types/schemas";
import type {
  StaffPricingCategory,
  StaffServiceCategory,
  TeamMember,
  TeamPermissions,
  TeamRole,
} from "../types/team";

interface StaffRow {
  id: string;
  display_name: string;
  role: TeamRole;
  is_active: boolean;
}

/** El código de 6 letras para vincular profesionales (solo lo lee el dueño, por RLS). */
export async function getLinkCode(businessId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_link_codes")
    .select("code")
    .eq("business_id", businessId)
    .maybeSingle();
  return data?.code ?? null;
}

/**
 * El equipo del negocio: el dueño primero y luego cada profesional en su orden, con lo que le
 * falta para salir en las reservas (horario y servicios activos).
 */
export async function getTeam(businessId: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("staff")
    .select("id, display_name, role, is_active")
    .eq("business_id", businessId)
    .order("position")
    .order("display_name");
  const rows: StaffRow[] = staff ?? [];
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];

  const [{ data: hours }, { data: services }] = await Promise.all([
    supabase
      .from("work_hours")
      .select("staff_id")
      .eq("business_id", businessId)
      .in("staff_id", ids),
    supabase
      .from("staff_services")
      .select("staff_id, services!inner(is_active)")
      .in("staff_id", ids)
      .eq("services.is_active", true),
  ]);
  const withHours = new Set((hours ?? []).map((row) => row.staff_id));
  const withServices = new Set((services ?? []).map((row) => row.staff_id));

  return rows
    .map((row) => ({
      id: row.id,
      displayName: row.display_name,
      role: row.role,
      isActive: row.is_active,
      hasHours: withHours.has(row.id),
      hasServices: withServices.has(row.id),
    }))
    .sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));
}

/** Una persona del equipo de este negocio, o null si no es de aquí. */
export async function getStaffMember(
  businessId: string,
  staffId: string,
): Promise<StaffRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("id, display_name, role, is_active")
    .eq("business_id", businessId)
    .eq("id", staffId)
    .maybeSingle();
  return data;
}

/** La fila activa en staff de la persona con sesión (para "Configurar cuenta"). */
export async function getMyStaff(
  profileId: string,
): Promise<(StaffRow & { businessId: string }) | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("id, display_name, role, is_active, business_id")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  const { business_id: businessId, ...row } = data;
  return { ...row, businessId };
}

/**
 * Los servicios activos del negocio por categoría, cada uno con si este profesional lo hace y su
 * duración propia (US-013 y US-014). Las categorías sin servicios activos no salen.
 */
export async function getStaffServiceOptions(
  businessId: string,
  staffId: string,
): Promise<StaffServiceCategory[]> {
  const supabase = await createClient();
  const [catalog, { data: assigned }] = await Promise.all([
    getCatalog(businessId),
    supabase
      .from("staff_services")
      .select("service_id, duration_minutes")
      .eq("staff_id", staffId),
  ]);
  const own = new Map(
    (assigned ?? []).map((row) => [row.service_id, row.duration_minutes]),
  );
  return catalog
    .map((category) => ({
      id: category.id,
      name: category.name,
      services: category.services
        .filter((service) => service.isActive)
        .map((service) => ({
          id: service.id,
          name: service.name,
          durationMinutes: service.durationMinutes,
          assigned: own.has(service.id),
          ownDuration: own.get(service.id) ?? null,
        })),
    }))
    .filter((category) => category.services.length > 0);
}

/**
 * Los servicios activos que hace un profesional, por categoría, con el precio general, el suyo y
 * su comisión (US-037). Las categorías sin servicios suyos no salen.
 */
export async function getStaffPricing(
  businessId: string,
  staffId: string,
): Promise<StaffPricingCategory[]> {
  const supabase = await createClient();
  // La comisión no se lee por la API: solo el dueño la ve con staff_commissions.
  const [catalog, { data: assigned }, { data: commissions }] =
    await Promise.all([
      getCatalog(businessId),
      supabase
        .from("staff_services")
        .select("service_id, price")
        .eq("staff_id", staffId),
      supabase.rpc("staff_commissions", { p_staff: staffId }),
    ]);
  const own = new Map((assigned ?? []).map((row) => [row.service_id, row]));
  const commission = new Map(
    (commissions ?? []).map((row) => [row.service_id, row.commission_pct]),
  );
  return catalog
    .map((category) => ({
      id: category.id,
      name: category.name,
      services: category.services
        .filter((service) => service.isActive && own.has(service.id))
        .map((service) => {
          return {
            id: service.id,
            name: service.name,
            generalPrice: service.price,
            ownPrice: own.get(service.id)?.price ?? null,
            commissionPct: Number(
              commission.get(service.id) ?? DEFAULT_COMMISSION,
            ),
          };
        }),
    }))
    .filter((category) => category.services.length > 0);
}

/** Los permisos del equipo del negocio (US-038); sin fila, los de la tabla al crearla. */
export async function getTeamPermissions(
  businessId: string,
): Promise<TeamPermissions> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_permissions")
    .select(
      "internal_clients, invoicing, manual_booking, manual_block, see_client_phone",
    )
    .eq("business_id", businessId)
    .maybeSingle();
  return {
    internalClients: data?.internal_clients ?? true,
    invoicing: data?.invoicing ?? true,
    manualBooking: data?.manual_booking ?? true,
    manualBlock: data?.manual_block ?? true,
    seeClientPhone: data?.see_client_phone ?? false,
  };
}
