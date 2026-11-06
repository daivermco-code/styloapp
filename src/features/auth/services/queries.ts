import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type DemoSide = "owner" | "staff" | "client";

export interface CurrentPerson {
  id: string;
  fullName: string | null;
  phone: string;
  side: DemoSide;
  /** "Dueña", "Profesional", "Cliente"… para el saludo y la bandeja. */
  roleLabel: string;
  business: { id: string; name: string } | null;
}

function roleLabel(side: DemoSide, gender: string | null): string {
  if (side === "owner") return gender === "female" ? "Dueña" : "Dueño";
  if (side === "staff") return "Profesional";
  return "Cliente";
}

/**
 * La persona con sesión, o null. Autoriza con auth.getUser() (invariante 2).
 * El lado sale de su fila activa en staff; sin ella, de su lado de demo (el profesional
 * sin negocio) o cliente.
 */
export const getCurrentPerson = cache(
  async (): Promise<CurrentPerson | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const [{ data: profile }, { data: member }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone, gender")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("staff")
        .select("role, business:businesses(id, name)")
        .eq("profile_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
    ]);
    if (!profile) return null;

    const side: DemoSide = member
      ? member.role
      : user.app_metadata.demo_side === "staff"
        ? "staff"
        : "client";

    return {
      id: user.id,
      fullName: profile.full_name,
      phone: profile.phone,
      side,
      roleLabel: roleLabel(side, profile.gender),
      business: member?.business ?? null,
    };
  },
);
