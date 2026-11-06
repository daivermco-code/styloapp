import "server-only";
import { cache } from "react";
import { getBookingCatalog } from "@/features/agenda/services/queries";
import type { BookingCategoryOption } from "@/features/agenda/types/agenda";
import { createClient } from "@/lib/supabase/server";
import { todayInBogota } from "@/shared/lib/dates";
import type {
  BusinessKind,
  BusinessPage,
  ExploreBusiness,
  ExplorePromotion,
  ExploreStaff,
  OfferItem,
} from "../types/explore";

const BUSINESS_COLUMNS =
  "id, slug, name, kind, address, neighborhood, city, lat, lng, logo_url, cover_url";

interface BusinessRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  address: string;
  neighborhood: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  logo_url: string | null;
  cover_url: string | null;
}

interface StatsRow {
  business_id: string;
  followers: number;
  bookings: number;
  score: number | null;
  reviews: number;
  following: boolean;
}

function toExploreBusiness(
  row: BusinessRow,
  stats: StatsRow | undefined,
): ExploreBusiness {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind as BusinessKind,
    address: row.address,
    neighborhood: row.neighborhood,
    city: row.city,
    lat: row.lat,
    lng: row.lng,
    logoUrl: row.logo_url,
    coverUrl: row.cover_url,
    followers: Number(stats?.followers ?? 0),
    bookings: Number(stats?.bookings ?? 0),
    score:
      stats?.score === null || stats?.score === undefined
        ? null
        : Number(stats.score),
    reviews: Number(stats?.reviews ?? 0),
    following: stats?.following ?? false,
  };
}

/**
 * Los negocios de Explorar (US-024): los listados, con sus números. Funciona sin sesión: la RLS
 * pública de `businesses` y `business_stats` solo devuelven negocios listados.
 */
export async function listBusinesses(): Promise<ExploreBusiness[]> {
  const supabase = await createClient();
  const [{ data: rows, error }, { data: stats }] = await Promise.all([
    supabase
      .from("businesses")
      .select(BUSINESS_COLUMNS)
      .eq("is_listed", true)
      .order("name"),
    supabase.rpc("business_stats", {}),
  ]);
  if (error) {
    console.error("[listBusinesses]", error.code);
    return [];
  }
  return (rows ?? []).map((row) =>
    toExploreBusiness(
      row,
      stats?.find((item) => item.business_id === row.id),
    ),
  );
}

/**
 * El id del negocio de un enlace `/n/<slug>` (US-033), o null si no es de ningún negocio listado.
 * Funciona sin sesión.
 */
export async function getBusinessIdBySlug(
  slug: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .eq("is_listed", true)
    .maybeSingle();
  return data?.id ?? null;
}

/** Quienes atienden en la app (los del catálogo), cada uno con su calificación. */
async function getStaffRatings(
  categories: BookingCategoryOption[],
): Promise<ExploreStaff[]> {
  const staff = new Map<string, string>();
  for (const service of categories.flatMap((category) => category.services)) {
    for (const option of service.staff) staff.set(option.id, option.name);
  }
  if (staff.size === 0) return [];
  const supabase = await createClient();
  const { data: ratings } = await supabase
    .from("staff_rating")
    .select("staff_id, score, reviews")
    .in("staff_id", [...staff.keys()]);
  return [...staff].map(([id, name]) => {
    const rating = ratings?.find((item) => item.staff_id === id);
    return {
      id,
      name,
      score: rating?.score == null ? null : Number(rating.score),
      reviews: Number(rating?.reviews ?? 0),
    };
  });
}

/**
 * Las ofertas de Ofertas (US-025): las promociones activas y sin vencer de los negocios listados,
 * cada una con su negocio y la calificación de él. Funciona sin sesión.
 */
export async function listOffers(): Promise<OfferItem[]> {
  const supabase = await createClient();
  const [{ data, error }, { data: stats }] = await Promise.all([
    supabase
      .from("promotions")
      .select(
        "id, kind, name, description, price, discount_pct, ends_on, image_url, businesses!inner(id, name, lat, lng, is_listed)",
      )
      .eq("is_active", true)
      .eq("businesses.is_listed", true)
      .or(`ends_on.is.null,ends_on.gte.${todayInBogota()}`),
    supabase.rpc("business_stats", {}),
  ]);
  if (error) {
    console.error("[listOffers]", error.code);
    return [];
  }
  return data.map((row) => {
    const rating = stats?.find(
      (item) => item.business_id === row.businesses.id,
    );
    return {
      id: row.id,
      kind: row.kind as OfferItem["kind"],
      name: row.name,
      description: row.description,
      price: row.price,
      discountPct: row.discount_pct,
      endsOn: row.ends_on,
      imageUrl: row.image_url,
      business: {
        id: row.businesses.id,
        name: row.businesses.name,
        lat: row.businesses.lat,
        lng: row.businesses.lng,
        score: rating?.score == null ? null : Number(rating.score),
        reviews: Number(rating?.reviews ?? 0),
      },
    };
  });
}

async function getActivePromotions(
  businessId: string,
): Promise<ExplorePromotion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("promotions")
    .select(
      "id, kind, name, description, price, discount_pct, ends_on, image_url",
    )
    .eq("business_id", businessId)
    .eq("is_active", true)
    .or(`ends_on.is.null,ends_on.gte.${todayInBogota()}`)
    .order("kind", { ascending: false })
    .order("created_at");
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind as ExplorePromotion["kind"],
    name: row.name,
    description: row.description,
    price: row.price,
    discountPct: row.discount_pct,
    endsOn: row.ends_on,
    imageUrl: row.image_url,
  }));
}

/**
 * La página del negocio (US-026): encabezado con sus números, servicios por categoría (sin los
 * archivados ni los que nadie hace), profesionales con su calificación y promociones vigentes.
 * Null si no existe o no está listado (la RLS no lo deja leer). Se guarda por petición: la usan
 * los metadatos y la página.
 */
export const getBusinessPage = cache(async function getBusinessPage(
  businessId: string,
): Promise<BusinessPage | null> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("businesses")
    .select(`${BUSINESS_COLUMNS}, whatsapp, online_booking`)
    .eq("id", businessId)
    .eq("is_listed", true)
    .maybeSingle();
  if (!row) return null;

  const [{ data: stats }, categories, promotions] = await Promise.all([
    supabase.rpc("business_stats", { p_business: businessId }),
    // El catálogo como lo ve el negocio entero: todos los profesionales activos (el dueño si
    // muestra su agenda), sin el filtro de un profesional.
    getBookingCatalog({ businessId, side: "owner", staffId: "" }),
    getActivePromotions(businessId),
  ]);
  const staff = await getStaffRatings(categories);
  return {
    ...toExploreBusiness(row, stats?.[0]),
    whatsapp: row.whatsapp,
    onlineBooking: row.online_booking,
    categories,
    staff,
    promotions,
  };
});
