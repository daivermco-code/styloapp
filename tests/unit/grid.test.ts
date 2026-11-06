import { describe, expect, it } from "vitest";
import {
  gridRange,
  minuteOfDay,
  parseDay,
  placeInGrid,
  quarterAt,
} from "@/features/agenda/lib/grid";

const DAY = "2026-11-02";

/** Un instante de Bogotá (UTC−5) en ISO. */
function bogota(day: string, clock: string): string {
  return new Date(`${day}T${clock}:00-05:00`).toISOString();
}

describe("parseDay", () => {
  it("acepta un día de verdad", () => {
    expect(parseDay("2026-11-02")).toBe("2026-11-02");
    expect(parseDay("2028-02-29")).toBe("2028-02-29");
  });

  it("rechaza lo que no es un día", () => {
    expect(parseDay(undefined)).toBeNull();
    expect(parseDay("")).toBeNull();
    expect(parseDay("mañana")).toBeNull();
    expect(parseDay("2026-11-2")).toBeNull();
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("2026-13-01")).toBeNull();
  });

  it("rechaza los años antes de 1900 (Date.UTC los corre a 19xx y Postgres no tiene año 0)", () => {
    expect(parseDay("0000-01-01")).toBeNull();
    expect(parseDay("0099-12-31")).toBeNull();
    expect(parseDay("1899-12-31")).toBeNull();
    expect(parseDay("1900-01-01")).toBe("1900-01-01");
  });
});

describe("minuteOfDay", () => {
  it("cuenta desde la medianoche de Bogotá", () => {
    expect(minuteOfDay(bogota(DAY, "09:30"), DAY)).toBe(570);
    expect(minuteOfDay(bogota("2026-11-01", "23:00"), DAY)).toBe(-60);
  });
});

describe("gridRange", () => {
  const open = [
    { starts: "09:00", ends: "13:00" },
    { starts: "14:00", ends: "19:00" },
  ];

  it("va del horario del negocio en horas enteras", () => {
    expect(gridRange(DAY, open, [])).toEqual({ start: 540, end: 1140 });
    expect(gridRange(DAY, [{ starts: "09:30", ends: "18:45" }], [])).toEqual({
      start: 540,
      end: 1140,
    });
  });

  it("se estira para mostrar una cita fuera del horario", () => {
    const late = {
      startsAt: bogota(DAY, "20:15"),
      endsAt: bogota(DAY, "20:45"),
    };
    const early = {
      startsAt: bogota(DAY, "07:45"),
      endsAt: bogota(DAY, "08:15"),
    };
    expect(gridRange(DAY, open, [late, early])).toEqual({
      start: 420,
      end: 1260,
    });
  });

  it("no se sale del día", () => {
    const night = {
      startsAt: bogota("2026-11-01", "23:30"),
      endsAt: bogota("2026-11-03", "00:30"),
    };
    expect(gridRange(DAY, [], [night])).toEqual({ start: 0, end: 1440 });
  });

  it("sin horario ni citas no hay grilla", () => {
    expect(gridRange(DAY, [], [])).toBeNull();
  });
});

describe("quarterAt", () => {
  const range = { start: 540, end: 1140 };

  it("da el cuarto de hora tocado", () => {
    expect(quarterAt(range, 0)).toBe(540);
    expect(quarterAt(range, 29)).toBe(540);
    expect(quarterAt(range, 30)).toBe(555);
    expect(quarterAt(range, 125)).toBe(600);
  });

  it("no se sale de la grilla", () => {
    expect(quarterAt(range, -10)).toBe(540);
    expect(quarterAt(range, 99_999)).toBe(1125);
  });
});

describe("placeInGrid", () => {
  const range = { start: 540, end: 1140 };

  it("pone la cita a su hora, 2 px por minuto y 1 px de aire", () => {
    expect(
      placeInGrid(
        range,
        { startsAt: bogota(DAY, "10:00"), endsAt: bogota(DAY, "10:45") },
        DAY,
      ),
    ).toEqual({ top: 121, height: 88 });
  });

  it("recorta lo que se sale del rango", () => {
    expect(
      placeInGrid(
        range,
        { startsAt: bogota(DAY, "08:00"), endsAt: bogota(DAY, "09:30") },
        DAY,
      ),
    ).toEqual({ top: 1, height: 58 });
    expect(
      placeInGrid(
        range,
        { startsAt: bogota(DAY, "20:00"), endsAt: bogota(DAY, "21:00") },
        DAY,
      ),
    ).toEqual({ top: 1321, height: 0 });
  });
});
