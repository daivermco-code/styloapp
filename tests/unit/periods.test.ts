import { describe, expect, it } from "vitest";
import {
  EXPENSE_PERIODS,
  parsePeriod,
  periodLabel,
  periodRange,
  shiftPeriod,
} from "@/shared/lib/periods";

// T-8.1.1 (US-042): los cinco periodos de Facturas, sus flechas y la fecha escrita. El 1 de
// noviembre de 2026 es domingo.
describe("periodRange", () => {
  it("el día es solo ese día", () => {
    expect(periodRange("dia", "2026-11-01")).toEqual({
      from: "2026-11-01",
      to: "2026-11-01",
    });
  });

  it("la semana va de lunes a domingo", () => {
    expect(periodRange("semana", "2026-11-01")).toEqual({
      from: "2026-10-26",
      to: "2026-11-01",
    });
    expect(periodRange("semana", "2026-11-02")).toEqual({
      from: "2026-11-02",
      to: "2026-11-08",
    });
    expect(periodRange("semana", "2026-11-05")).toEqual({
      from: "2026-11-02",
      to: "2026-11-08",
    });
  });

  it("la quincena va del 1 al 15 y del 16 al fin de mes", () => {
    expect(periodRange("quincena", "2026-11-15")).toEqual({
      from: "2026-11-01",
      to: "2026-11-15",
    });
    expect(periodRange("quincena", "2026-11-16")).toEqual({
      from: "2026-11-16",
      to: "2026-11-30",
    });
    expect(periodRange("quincena", "2028-02-20")).toEqual({
      from: "2028-02-16",
      to: "2028-02-29",
    });
  });

  it("el mes y el año van completos", () => {
    expect(periodRange("mes", "2026-02-10")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(periodRange("mes", "2026-12-31")).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
    expect(periodRange("ano", "2026-07-04")).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });
});

describe("shiftPeriod", () => {
  it("mueve el día de uno en uno, también entre meses y años", () => {
    expect(shiftPeriod("dia", "2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftPeriod("dia", "2026-12-31", 1)).toBe("2027-01-01");
  });

  it("lleva al lunes de la semana anterior o de la siguiente", () => {
    expect(shiftPeriod("semana", "2026-11-04", -1)).toBe("2026-10-26");
    expect(shiftPeriod("semana", "2026-11-04", 1)).toBe("2026-11-09");
  });

  it("salta de quincena a quincena", () => {
    expect(shiftPeriod("quincena", "2026-11-10", 1)).toBe("2026-11-16");
    expect(shiftPeriod("quincena", "2026-11-20", 1)).toBe("2026-12-01");
    expect(shiftPeriod("quincena", "2026-11-20", -1)).toBe("2026-11-01");
    expect(shiftPeriod("quincena", "2026-11-10", -1)).toBe("2026-10-16");
  });

  it("salta de mes y de año al primer día", () => {
    expect(shiftPeriod("mes", "2026-03-31", -1)).toBe("2026-02-01");
    expect(shiftPeriod("mes", "2026-12-15", 1)).toBe("2027-01-01");
    expect(shiftPeriod("ano", "2026-06-15", -1)).toBe("2025-01-01");
    expect(shiftPeriod("ano", "2026-06-15", 1)).toBe("2027-01-01");
  });
});

describe("periodLabel", () => {
  it("escribe el día como en la historia", () => {
    expect(periodLabel("dia", "2026-11-01")).toBe(
      "Día: domingo, 1 de noviembre de 2026",
    );
    expect(periodLabel("dia", "2026-11-04")).toBe(
      "Día: miércoles, 4 de noviembre de 2026",
    );
  });

  it("no repite el mes ni el año cuando son los mismos", () => {
    expect(periodLabel("semana", "2026-11-05")).toBe(
      "Semana: del 2 al 8 de noviembre de 2026",
    );
    expect(periodLabel("semana", "2026-11-01")).toBe(
      "Semana: del 26 de octubre al 1 de noviembre de 2026",
    );
    expect(periodLabel("semana", "2026-12-30")).toBe(
      "Semana: del 28 de diciembre de 2026 al 3 de enero de 2027",
    );
    expect(periodLabel("quincena", "2026-11-20")).toBe(
      "Quincena: del 16 al 30 de noviembre de 2026",
    );
  });

  it("escribe el mes y el año", () => {
    expect(periodLabel("mes", "2026-11-01")).toBe("Mes: noviembre de 2026");
    expect(periodLabel("ano", "2026-11-01")).toBe("Año: 2026");
  });
});

describe("parsePeriod", () => {
  it("acepta solo los periodos permitidos", () => {
    expect(parsePeriod("quincena")).toBe("quincena");
    expect(parsePeriod(undefined)).toBeNull();
    expect(parsePeriod("hora")).toBeNull();
    expect(parsePeriod("quincena", EXPENSE_PERIODS)).toBeNull();
    expect(parsePeriod("mes", EXPENSE_PERIODS)).toBe("mes");
  });
});
