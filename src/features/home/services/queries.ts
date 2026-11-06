import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { HomeBusiness, HomeCounters } from "../types/home";

/** El negocio de quien está en /pro, con el slug para el enlace y el QR. */
export async function getHomeBusiness(
  businessId: string,
): Promise<HomeBusiness | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("id, name, slug")
    .eq("id", businessId)
    .maybeSingle();
  return data;
}

/**
 * Contadores del inicio con `home_counters` (en ceros hasta las Fases 3 y 5, que reescriben la
 * función). null si no se pudieron leer.
 */
export async function getHomeCounters(
  businessId: string,
): Promise<HomeCounters | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("home_counters", {
    p_business: businessId,
  });
  if (error) {
    console.error("[getHomeCounters]", error.code, error.message);
    return null;
  }
  const row = data[0];
  return {
    followers: row?.followers ?? 0,
    bookings: row?.bookings ?? 0,
    rating: row?.rating ?? null,
    reviews: row?.reviews ?? 0,
    invoices: row?.invoices ?? 0,
  };
}
