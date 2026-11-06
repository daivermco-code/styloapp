import { describe, expect, it } from "vitest";
import { selectionMinutes, toggleQuarter } from "@/features/agenda/lib/blocks";

// Cuadritos 0 a 11 libres, menos el 5 y el 6 (una cita).
const isFree = (quarter: number) => quarter !== 5 && quarter !== 6;

describe("toggleQuarter", () => {
  it("el primer toque empieza la selección", () => {
    expect(toggleQuarter(null, 2, isFree)).toEqual({ from: 2, to: 2 });
  });

  it("un cuadrito ocupado no cambia nada", () => {
    expect(toggleQuarter(null, 5, isFree)).toBeNull();
    expect(toggleQuarter({ from: 1, to: 2 }, 6, isFree)).toEqual({
      from: 1,
      to: 2,
    });
  });

  it("fuera del rango lo alarga hasta ahí, hacia arriba o hacia abajo", () => {
    expect(toggleQuarter({ from: 2, to: 2 }, 4, isFree)).toEqual({
      from: 2,
      to: 4,
    });
    expect(toggleQuarter({ from: 2, to: 3 }, 0, isFree)).toEqual({
      from: 0,
      to: 3,
    });
  });

  it("si en medio hay algo ocupado, empieza de nuevo", () => {
    expect(toggleQuarter({ from: 2, to: 3 }, 8, isFree)).toEqual({
      from: 8,
      to: 8,
    });
  });

  it("las puntas se quitan; el único cuadrito deja la selección vacía", () => {
    expect(toggleQuarter({ from: 2, to: 4 }, 2, isFree)).toEqual({
      from: 3,
      to: 4,
    });
    expect(toggleQuarter({ from: 2, to: 4 }, 4, isFree)).toEqual({
      from: 2,
      to: 3,
    });
    expect(toggleQuarter({ from: 2, to: 2 }, 2, isFree)).toBeNull();
  });

  it("en medio del rango empieza de nuevo en ese cuadrito", () => {
    expect(toggleQuarter({ from: 0, to: 4 }, 2, isFree)).toEqual({
      from: 2,
      to: 2,
    });
  });
});

describe("selectionMinutes", () => {
  it("cada cuadrito son 15 minutos", () => {
    expect(selectionMinutes({ from: 3, to: 3 })).toBe(15);
    expect(selectionMinutes({ from: 2, to: 5 })).toBe(60);
  });
});
