import { describe, expect, it } from "vitest";
import {
  canClientCancel,
  overlaps,
  reputationLevel,
  reputationText,
} from "@/features/agenda/lib/rules";

const at = (clock: string) => `2026-11-02T${clock}:00Z`;

describe("overlaps", () => {
  it("dos rangos que se pisan se cruzan", () => {
    const a = { startsAt: at("10:00"), endsAt: at("10:30") };
    expect(overlaps(a, { startsAt: at("10:15"), endsAt: at("10:45") })).toBe(
      true,
    );
    expect(overlaps(a, { startsAt: at("09:00"), endsAt: at("11:00") })).toBe(
      true,
    );
  });

  it("pegados o separados no se cruzan", () => {
    const a = { startsAt: at("10:00"), endsAt: at("10:30") };
    expect(overlaps(a, { startsAt: at("10:30"), endsAt: at("11:00") })).toBe(
      false,
    );
    expect(overlaps(a, { startsAt: at("09:00"), endsAt: at("10:00") })).toBe(
      false,
    );
    expect(overlaps(a, { startsAt: at("12:00"), endsAt: at("12:30") })).toBe(
      false,
    );
  });
});

describe("canClientCancel", () => {
  const startsAt = at("15:00");

  it("cancela si falta más que el límite", () => {
    expect(canClientCancel(startsAt, 15, at("14:44"))).toBe(true);
  });

  it("no cancela justo en el límite, ni después de empezar", () => {
    expect(canClientCancel(startsAt, 15, at("14:45"))).toBe(false);
    expect(canClientCancel(startsAt, 0, at("15:00"))).toBe(false);
    expect(canClientCancel(startsAt, 0, at("15:10"))).toBe(false);
  });
});

describe("reputationLevel", () => {
  it("sin calificaciones no hay nivel", () => {
    expect(reputationLevel(null)).toBe("unknown");
  });

  it("corta en 4 y en 2,5", () => {
    expect(reputationLevel(5)).toBe("excellent");
    expect(reputationLevel(4)).toBe("excellent");
    expect(reputationLevel(3.99)).toBe("regular");
    expect(reputationLevel(2.5)).toBe("regular");
    expect(reputationLevel(2.49)).toBe("bad");
    expect(reputationLevel(1)).toBe("bad");
  });
});

describe("reputationText", () => {
  it("dice el nivel con el promedio en coma, o que no tiene calificaciones", () => {
    expect(reputationText(null)).toBe("Sin calificaciones todavía");
    expect(reputationText({ score: 4.5 })).toBe("Excelente (4,5 de 5)");
    expect(reputationText({ score: 3 })).toBe("Regular (3 de 5)");
    expect(reputationText({ score: 1.25 })).toBe("Mala (1,3 de 5)");
  });
});
