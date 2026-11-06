/** El lado de quien está en /pro: el dueño o un profesional del equipo. */
export type StaffSide = "owner" | "staff";

export interface HomeBusiness {
  id: string;
  name: string;
  slug: string;
}

/** Contadores del inicio (US-006 y US-007). Del profesional, los suyos. */
export interface HomeCounters {
  followers: number;
  bookings: number;
  /** Promedio de 1 a 5; null sin reseñas. */
  rating: number | null;
  reviews: number;
  invoices: number;
}
