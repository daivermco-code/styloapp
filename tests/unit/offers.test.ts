import { describe, expect, it } from "vitest";
import { DEMO_POINT } from "@/features/explore/lib/distance";
import { arrangeOffers } from "@/features/explore/lib/offers";
import type { OfferItem } from "@/features/explore/types/explore";

// Ofertas de prueba en tres barrios de Bogotá (US-025).
function offer(
  name: string,
  kind: OfferItem["kind"],
  price: number,
  discountPct: number | null,
  point: { lat: number; lng: number } | null,
): OfferItem {
  return {
    id: name,
    kind,
    name,
    description: null,
    price,
    discountPct,
    endsOn: null,
    imageUrl: null,
    business: {
      id: `negocio-${name}`,
      name: `Negocio ${name}`,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      score: null,
      reviews: 0,
    },
  };
}

const CHAPINERO = { lat: 4.644, lng: -74.064 };
const USAQUEN = { lat: 4.696, lng: -74.031 };
const CANDELARIA = { lat: 4.597, lng: -74.072 };

const OFFERS = [
  offer("Fade", "promo", 27000, 15, USAQUEN),
  offer("Corte y barba", "combo", 40000, null, CHAPINERO),
  offer("Cepillado", "promo", 24000, 20, CANDELARIA),
  offer("Sin lugar", "promo", 30000, 50, null),
];

const names = (list: { name: string }[]) => list.map((item) => item.name);

describe("arrangeOffers", () => {
  it("por precio va de la más barata a la más cara", () => {
    expect(names(arrangeOffers(OFFERS, "price", "all", DEMO_POINT))).toEqual([
      "Cepillado",
      "Fade",
      "Sin lugar",
      "Corte y barba",
    ]);
  });

  it("por descuento va del mayor al menor y los combos al final", () => {
    expect(names(arrangeOffers(OFFERS, "discount", "all", DEMO_POINT))).toEqual(
      ["Sin lugar", "Cepillado", "Fade", "Corte y barba"],
    );
  });

  it("por cercanía va de la más cerca a la más lejos y sin lugar al final", () => {
    const sorted = arrangeOffers(OFFERS, "distance", "all", DEMO_POINT);
    expect(names(sorted)).toEqual([
      "Corte y barba",
      "Cepillado",
      "Fade",
      "Sin lugar",
    ]);
    expect(sorted[0].distanceKm).toBeCloseTo(0.55, 1);
    expect(sorted[3].distanceKm).toBeNull();
  });

  it("filtra por tipo", () => {
    expect(names(arrangeOffers(OFFERS, "price", "combo", DEMO_POINT))).toEqual([
      "Corte y barba",
    ]);
    expect(arrangeOffers(OFFERS, "price", "promo", DEMO_POINT)).toHaveLength(3);
  });

  it("los empates quedan por nombre", () => {
    const tie = [
      offer("Uñas", "promo", 20000, 10, CHAPINERO),
      offer("Barba", "promo", 20000, 10, USAQUEN),
    ];
    expect(names(arrangeOffers(tie, "price", "all", DEMO_POINT))).toEqual([
      "Barba",
      "Uñas",
    ]);
  });
});
