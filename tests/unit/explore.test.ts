import { describe, expect, it } from "vitest";
import type { BookingCategoryOption } from "@/features/agenda/types/agenda";
import { workSamples } from "@/features/explore/lib/samples";
import {
  filterServices,
  findService,
  plainText,
} from "@/features/explore/lib/search";

function service(id: string, name: string) {
  return {
    id,
    name,
    priceLabel: "$ 25.000",
    durationMinutes: 30,
    staff: [],
  };
}

const CATALOG: BookingCategoryOption[] = [
  {
    id: "cortes",
    name: "Cortes",
    services: [service("a", "Corte clásico"), service("b", "Corte fade")],
  },
  {
    id: "barba",
    name: "Barba",
    services: [service("c", "Perfilado de barba")],
  },
];

describe("plainText", () => {
  it("quita tildes, mayúsculas y espacios de los lados", () => {
    expect(plainText("  La Candelaria ")).toBe("la candelaria");
    expect(plainText("Uñas y Arte")).toBe("unas y arte");
    expect(plainText("CLÁSICO")).toBe("clasico");
  });
});

describe("filterServices", () => {
  it("sin búsqueda devuelve el catálogo entero", () => {
    expect(filterServices(CATALOG, "  ")).toBe(CATALOG);
  });

  it("busca sin tildes y deja fuera las categorías vacías", () => {
    const found = filterServices(CATALOG, "clasico");
    expect(found).toHaveLength(1);
    expect(found[0].services.map((item) => item.id)).toEqual(["a"]);
  });

  it("encuentra en varias categorías", () => {
    expect(
      filterServices(CATALOG, "o").flatMap((category) =>
        category.services.map((item) => item.id),
      ),
    ).toEqual(["a", "b", "c"]);
  });

  it("sin resultados devuelve una lista vacía", () => {
    expect(filterServices(CATALOG, "masaje")).toEqual([]);
  });
});

describe("findService", () => {
  it("encuentra el servicio en cualquier categoría", () => {
    expect(findService(CATALOG, "c")?.name).toBe("Perfilado de barba");
  });

  it("devuelve null si no está o no hay id", () => {
    expect(findService(CATALOG, "z")).toBeNull();
    expect(findService(CATALOG, null)).toBeNull();
  });
});

describe("workSamples", () => {
  it("da cuatro muestras propias del tipo de negocio", () => {
    const samples = workSamples("nail_spa");
    expect(samples).toHaveLength(4);
    expect(samples[0]).toEqual({
      src: "/demo/muestras/nail_spa-1.svg",
      caption: "Semipermanente",
    });
    expect(samples.map((sample) => sample.src)).toContain(
      "/demo/muestras/nail_spa-4.svg",
    );
  });
});
