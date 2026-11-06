// Distancias de Explorar (US-024). Puro: sirve igual en el servidor y en el navegador.

export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * El punto fijo de la demo: el Parque de Lourdes, en Chapinero (Bogotá). Se usa cuando el
 * navegador no da la ubicación real o la persona no la permite.
 */
export const DEMO_POINT: GeoPoint = { lat: 4.6487, lng: -74.0631 };

const EARTH_RADIUS_KM = 6371;

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Distancia en línea recta entre dos puntos, en km (fórmula del haversine). */
export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.lat)) *
      Math.cos(radians(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Como se lee en las tarjetas: "850 m" por debajo de 1 km, "1,2 km" desde ahí. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km.toLocaleString("es-CO", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`;
}

/**
 * Los negocios del más cercano al más lejano desde `origin`, cada uno con su distancia en km.
 * Los que no tienen coordenadas van al final, en el orden en que llegaron.
 */
export function sortByDistance<
  T extends { lat: number | null; lng: number | null },
>(items: T[], origin: GeoPoint): (T & { distanceKm: number | null })[] {
  return items
    .map((item) => ({
      ...item,
      distanceKm:
        item.lat === null || item.lng === null
          ? null
          : distanceKm(origin, { lat: item.lat, lng: item.lng }),
    }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}
