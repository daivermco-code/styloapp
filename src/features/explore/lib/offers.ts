// Orden y filtro de Ofertas (US-025). Puro: sirve igual en el servidor y en el navegador.
import type { OfferItem } from "../types/explore";
import { distanceKm, type GeoPoint } from "./distance";

export type OfferSort = "price" | "discount" | "distance";
export type OfferKind = "all" | "promo" | "combo";

export type PlacedOffer = OfferItem & { distanceKm: number | null };

/**
 * Las ofertas del tipo pedido, cada una con la distancia a su negocio desde `origin`. Precio: de
 * la más barata a la más cara; descuento: del mayor al menor (los combos, sin descuento, al
 * final); distancia: de la más cerca a la más lejos (sin coordenadas, al final). Los empates
 * quedan por nombre.
 */
export function arrangeOffers(
  offers: OfferItem[],
  sort: OfferSort,
  kind: OfferKind,
  origin: GeoPoint,
): PlacedOffer[] {
  const key = (offer: PlacedOffer): number => {
    if (sort === "price") return offer.price;
    if (sort === "discount") return -(offer.discountPct ?? 0);
    return offer.distanceKm ?? Infinity;
  };
  return offers
    .filter((offer) => kind === "all" || offer.kind === kind)
    .map((offer) => ({
      ...offer,
      distanceKm:
        offer.business.lat === null || offer.business.lng === null
          ? null
          : distanceKm(origin, {
              lat: offer.business.lat,
              lng: offer.business.lng,
            }),
    }))
    .sort((a, b) => key(a) - key(b) || a.name.localeCompare(b.name, "es"));
}
