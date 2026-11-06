import { describe, expect, it } from "vitest";
import {
  DEMO_POINT,
  distanceKm,
  formatDistance,
  sortByDistance,
} from "@/features/explore/lib/distance";

// Negocios de la semilla (barrios de Bogotá).
const CHAPINERO = { lat: 4.644, lng: -74.064 };
const USAQUEN = { lat: 4.696, lng: -74.031 };
const CANDELARIA = { lat: 4.597, lng: -74.072 };

describe("distanceKm", () => {
  it("es cero en el mismo punto", () => {
    expect(distanceKm(DEMO_POINT, DEMO_POINT)).toBe(0);
  });

  it("da la distancia en línea recta entre dos barrios", () => {
    // Chapinero a Usaquén: unos 6,9 km en línea recta.
    expect(distanceKm(CHAPINERO, USAQUEN)).toBeCloseTo(6.86, 1);
    // Un grado de latitud son unos 111,2 km.
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(
      111.19,
      1,
    );
  });

  it("es la misma de ida y de vuelta", () => {
    expect(distanceKm(CHAPINERO, CANDELARIA)).toBeCloseTo(
      distanceKm(CANDELARIA, CHAPINERO),
      10,
    );
  });
});

describe("formatDistance", () => {
  it("dice metros por debajo de 1 km, redondeados a 10", () => {
    expect(formatDistance(0.534)).toBe("530 m");
    expect(formatDistance(0.001)).toBe("10 m");
  });

  it("dice kilómetros con una cifra decimal y coma", () => {
    expect(formatDistance(1)).toBe("1,0 km");
    expect(formatDistance(6.86)).toBe("6,9 km");
    expect(formatDistance(12.04)).toBe("12,0 km");
  });
});

describe("sortByDistance", () => {
  it("ordena del más cercano al más lejano y deja al final los que no tienen coordenadas", () => {
    const sorted = sortByDistance(
      [
        { name: "Sin mapa", lat: null, lng: null },
        { name: "Usaquén", ...USAQUEN },
        { name: "Chapinero", ...CHAPINERO },
        { name: "Candelaria", ...CANDELARIA },
      ],
      DEMO_POINT,
    );
    expect(sorted.map((item) => item.name)).toEqual([
      "Chapinero",
      "Candelaria",
      "Usaquén",
      "Sin mapa",
    ]);
    expect(sorted[0].distanceKm).toBeLessThan(1);
    expect(sorted[3].distanceKm).toBeNull();
  });

  it("sin una de las dos coordenadas tampoco tiene distancia", () => {
    const sorted = sortByDistance(
      [
        { name: "Solo latitud", lat: 4.6, lng: null },
        { name: "Sin mapa", lat: null, lng: null },
      ],
      DEMO_POINT,
    );
    expect(sorted.map((item) => item.distanceKm)).toEqual([null, null]);
  });
});
