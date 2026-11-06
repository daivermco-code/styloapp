import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DemoSide } from "@/features/auth/services/queries";

export interface DemoPersona {
  id: string;
  name: string;
  side: DemoSide;
  businessName: string | null;
}

function isDemoSide(value: unknown): value is DemoSide {
  return value === "owner" || value === "staff" || value === "client";
}

/**
 * Las personas de la demo para la pantalla de inicio (US-002), en el orden de la semilla:
 * el dueño del negocio completo primero. Llave de servicio: listar personas de demo es uno de
 * sus tres usos (invariante 4). Solo salen las cuentas sembradas (con demo_side).
 */
export async function listDemoPersonas(): Promise<DemoPersona[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;

  const seeded = data.users
    .filter((user) => isDemoSide(user.app_metadata.demo_side))
    .sort(
      (a, b) =>
        Number(a.app_metadata.demo_order ?? 0) -
        Number(b.app_metadata.demo_order ?? 0),
    );
  if (seeded.length === 0) return [];

  const ids = seeded.map((user) => user.id);
  const [{ data: profiles }, { data: staff }] = await Promise.all([
    admin.from("profiles").select("id, full_name").in("id", ids),
    admin
      .from("staff")
      .select("profile_id, business:businesses(name)")
      .in("profile_id", ids)
      .eq("is_active", true),
  ]);
  const names = new Map(profiles?.map((p) => [p.id, p.full_name]));
  const businesses = new Map(
    staff?.map((s) => [s.profile_id, s.business?.name ?? null]),
  );

  return seeded.map((user) => ({
    id: user.id,
    name: names.get(user.id) ?? "Persona de la demo",
    side: user.app_metadata.demo_side as DemoSide,
    businessName: businesses.get(user.id) ?? null,
  }));
}

/** Celular (+57…) de una persona sembrada, para escribirlo en /entrar. */
export async function demoPersonaPhone(id: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(id);
  if (!data.user || !isDemoSide(data.user.app_metadata.demo_side)) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("phone")
    .eq("id", id)
    .maybeSingle();
  return profile?.phone ?? null;
}
