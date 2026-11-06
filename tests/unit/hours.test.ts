import { describe, expect, it } from "vitest";
import {
  clockOptions,
  effectiveRanges,
  END_BEFORE_START,
  findRangeError,
  fitsWithin,
  formatClock,
  nextRange,
  RANGES_OVERLAP,
  rowsToWeek,
} from "@/features/agenda/lib/hours";

describe("effectiveRanges", () => {
  it("deja solo lo que cae dentro del horario del negocio", () => {
    expect(
      effectiveRanges(
        [{ starts: "09:00", ends: "17:00" }],
        [{ starts: "08:00", ends: "19:00" }],
      ),
    ).toEqual([{ starts: "09:00", ends: "17:00" }]);
  });

  it("parte la franja del profesional cuando el negocio cierra al almuerzo", () => {
    expect(
      effectiveRanges(
        [
          { starts: "13:00", ends: "19:00" },
          { starts: "08:00", ends: "12:00" },
        ],
        [{ starts: "10:00", ends: "15:00" }],
      ),
    ).toEqual([
      { starts: "10:00", ends: "12:00" },
      { starts: "13:00", ends: "15:00" },
    ]);
  });

  it("no ofrece horas si el negocio está cerrado ese día", () => {
    expect(effectiveRanges([], [{ starts: "09:00", ends: "13:00" }])).toEqual(
      [],
    );
  });

  it("no cuenta los bordes que solo se tocan", () => {
    expect(
      effectiveRanges(
        [{ starts: "09:00", ends: "12:00" }],
        [{ starts: "12:00", ends: "18:00" }],
      ),
    ).toEqual([]);
  });
});

describe("findRangeError", () => {
  it("acepta franjas en orden que se tocan en el borde", () => {
    expect(
      findRangeError([
        { starts: "14:00", ends: "19:00" },
        { starts: "09:00", ends: "14:00" },
      ]),
    ).toBeNull();
  });

  it("pide que la hora final vaya después de la inicial", () => {
    expect(findRangeError([{ starts: "18:00", ends: "09:00" }])).toBe(
      END_BEFORE_START,
    );
    expect(findRangeError([{ starts: "09:00", ends: "09:00" }])).toBe(
      END_BEFORE_START,
    );
  });

  it("avisa cuando dos franjas se cruzan", () => {
    expect(
      findRangeError([
        { starts: "09:00", ends: "13:00" },
        { starts: "12:30", ends: "18:00" },
      ]),
    ).toBe(RANGES_OVERLAP);
  });
});

describe("horas del editor", () => {
  it("dice las horas como en Colombia", () => {
    expect(formatClock("00:00")).toBe("12:00 a. m.");
    expect(formatClock("09:30")).toBe("9:30 a. m.");
    expect(formatClock("12:00")).toBe("12:00 p. m.");
    expect(formatClock("19:45:00")).toBe("7:45 p. m.");
  });

  it("ofrece el día entero cada 15 minutos", () => {
    const options = clockOptions();
    expect(options).toHaveLength(96);
    expect(options[0]).toBe("00:00");
    expect(options.at(-1)).toBe("23:45");
  });

  it("arma la semana desde las filas de la base, en orden", () => {
    const week = rowsToWeek([
      { weekday: 2, starts: "14:00:00", ends: "19:00:00" },
      { weekday: 2, starts: "10:00:00", ends: "13:00:00" },
    ]);
    expect(week[2]).toEqual([
      { starts: "10:00", ends: "13:00" },
      { starts: "14:00", ends: "19:00" },
    ]);
    expect(week[0]).toEqual([]);
  });

  it("propone la franja siguiente sin pasarse de la medianoche", () => {
    expect(nextRange([])).toEqual({ starts: "09:00", ends: "18:00" });
    expect(nextRange([{ starts: "09:00", ends: "13:00" }])).toEqual({
      starts: "14:00",
      ends: "18:00",
    });
    expect(nextRange([{ starts: "09:00", ends: "23:00" }])).toEqual({
      starts: "23:30",
      ends: "23:45",
    });
  });
});

describe("fitsWithin", () => {
  const business = [
    { starts: "09:00", ends: "13:00" },
    { starts: "13:00", ends: "19:00" },
  ];

  it("acepta franjas dentro del horario, también entre franjas que se tocan", () => {
    expect(fitsWithin([{ starts: "09:00", ends: "13:00" }], business)).toBe(
      true,
    );
    expect(fitsWithin([{ starts: "10:00", ends: "15:00" }], business)).toBe(
      true,
    );
    expect(fitsWithin([], [])).toBe(true);
    // Una franja del negocio metida dentro de otra no la acorta.
    expect(
      fitsWithin(
        [{ starts: "09:00", ends: "19:00" }],
        [
          { starts: "09:00", ends: "19:00" },
          { starts: "10:00", ends: "12:00" },
        ],
      ),
    ).toBe(true);
  });

  it("rechaza lo que se sale del horario o un día que el negocio cierra", () => {
    expect(fitsWithin([{ starts: "08:30", ends: "12:00" }], business)).toBe(
      false,
    );
    expect(fitsWithin([{ starts: "18:00", ends: "20:00" }], business)).toBe(
      false,
    );
    expect(
      fitsWithin(
        [{ starts: "10:00", ends: "15:00" }],
        [
          { starts: "09:00", ends: "12:00" },
          { starts: "14:00", ends: "19:00" },
        ],
      ),
    ).toBe(false);
    expect(fitsWithin([{ starts: "10:00", ends: "12:00" }], [])).toBe(false);
  });
});
