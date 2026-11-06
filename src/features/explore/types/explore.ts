import type { BookingCategoryOption } from "@/features/agenda/types/agenda";

export type BusinessKind = "barbershop" | "nail_spa" | "salon" | "spa";

/** Un negocio listado en Explorar (US-024), con sus números de `business_stats`. */
export interface ExploreBusiness {
  id: string;
  slug: string;
  name: string;
  kind: BusinessKind;
  address: string;
  neighborhood: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  logoUrl: string | null;
  coverUrl: string | null;
  followers: number;
  bookings: number;
  /** Promedio de las reseñas (1 a 5), o null si no tiene. */
  score: number | null;
  reviews: number;
  /** Si quien mira lo sigue (sin sesión, siempre false). */
  following: boolean;
}

/** Un profesional en la pestaña Profesionales, con su calificación. */
export interface ExploreStaff {
  id: string;
  name: string;
  score: number | null;
  reviews: number;
}

/** Una promoción o combo vigente (activo y sin vencer). */
export interface ExplorePromotion {
  id: string;
  kind: "promo" | "combo";
  name: string;
  description: string | null;
  price: number;
  discountPct: number | null;
  endsOn: string | null;
  imageUrl: string | null;
}

/** Todo lo de la página del negocio (US-026). */
export interface BusinessPage extends ExploreBusiness {
  whatsapp: string | null;
  onlineBooking: boolean;
  /** Servicios activos que algún profesional hace, por categoría, con quién los hace. */
  categories: BookingCategoryOption[];
  staff: ExploreStaff[];
  promotions: ExplorePromotion[];
}

/** Una oferta de la pantalla Ofertas (US-025): la promoción con su negocio y la calificación. */
export interface OfferItem extends ExplorePromotion {
  business: {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    score: number | null;
    reviews: number;
  };
}
