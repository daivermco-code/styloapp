import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MyReview } from "../types/review";

/**
 * La reputación de quien tiene sesión (US-031): el promedio de sus llegadas en todos los
 * negocios, de `client_reputation`. Null sin sesión o sin citas marcadas.
 */
export async function getMyReputation(): Promise<number | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc("client_reputation", {
    p_profile: user.id,
  });
  if (error) {
    console.error("[getMyReputation]", error.code);
    return null;
  }
  const score = data?.[0]?.score;
  return score === null || score === undefined ? null : Number(score);
}

/** Las reseñas que dejó quien tiene sesión, de la más nueva a la más vieja (US-031). */
export async function getMyReviews(): Promise<MyReview[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, attention, quality, comment, created_at, businesses(name), staff(display_name), bookings(services(name))",
    )
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[getMyReviews]", error.code);
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    attention: row.attention,
    quality: row.quality,
    comment: row.comment,
    createdAt: row.created_at,
    businessName: row.businesses.name,
    staffName: row.staff.display_name,
    serviceName: row.bookings.services.name,
  }));
}
