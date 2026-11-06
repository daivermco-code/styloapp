import { describe, expect, it } from "vitest";
import {
  deleteSeriesWarning,
  recurringDates,
  seriesDateStatus,
  seriesLeft,
  seriesRhythm,
  seriesSummary,
} from "@/features/agenda/lib/recurring";

describe("recurringDates", () => {
  it("semanal y quincenal cuentan desde el primer día", () => {
    expect(recurringDates("2026-11-03", "weekly", 3)).toEqual([
      "2026-11-03",
      "2026-11-10",
      "2026-11-17",
    ]);
    expect(recurringDates("2026-12-22", "biweekly", 3)).toEqual([
      "2026-12-22",
      "2027-01-05",
      "2027-01-19",
    ]);
  });

  it("mensual va el mismo día del mes, o el último si el mes no lo tiene", () => {
    expect(recurringDates("2026-01-31", "monthly", 4)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
    expect(recurringDates("2027-11-30", "monthly", 4)).toEqual([
      "2027-11-30",
      "2027-12-30",
      "2028-01-30",
      "2028-02-29",
    ]);
  });

  it("una sola cita es solo el primer día", () => {
    expect(recurringDates("2026-11-03", "monthly", 1)).toEqual(["2026-11-03"]);
  });
});

describe("seriesDateStatus", () => {
  const base = {
    day: "2026-11-10",
    time: "10:00",
    durationMinutes: 30,
    workRanges: [
      { starts: "10:00", ends: "13:00" },
      { starts: "14:00", ends: "19:00" },
    ],
    busy: [],
    now: "2026-11-01T12:00:00Z",
  };

  it("libre si cabe en una franja y no se cruza con nada", () => {
    expect(seriesDateStatus(base)).toBe("free");
    expect(seriesDateStatus({ ...base, time: "12:30" })).toBe("free");
  });

  it("ocupada si se cruza con una cita o un bloqueo", () => {
    const busy = [
      { startsAt: "2026-11-10T15:15:00Z", endsAt: "2026-11-10T15:45:00Z" },
    ];
    expect(seriesDateStatus({ ...base, busy })).toBe("busy");
  });

  it("fuera de horario si no cabe entera en una franja o ese día no atiende", () => {
    expect(seriesDateStatus({ ...base, time: "12:45" })).toBe("closed");
    expect(seriesDateStatus({ ...base, time: "09:30" })).toBe("closed");
    expect(seriesDateStatus({ ...base, workRanges: [] })).toBe("closed");
  });

  it("ya pasó si la hora es antes de ahora", () => {
    expect(seriesDateStatus({ ...base, now: "2026-11-10T15:01:00Z" })).toBe(
      "past",
    );
  });
});

describe("seriesSummary", () => {
  it("dice cuántas se crearon", () => {
    expect(seriesSummary(10, 0, 0)).toBe("Se crearon 10 citas.");
    expect(seriesSummary(1, 0, 0)).toBe("Se creó 1 cita.");
  });

  it("y por qué faltan las otras", () => {
    expect(seriesSummary(8, 2, 0)).toBe(
      "Se crearon 8 citas. 2 no, porque la hora estaba ocupada.",
    );
    expect(seriesSummary(9, 0, 1)).toBe(
      "Se crearon 9 citas. 1 no, porque caen fuera del horario.",
    );
    expect(seriesSummary(7, 2, 1)).toBe(
      "Se crearon 7 citas. 3 no, porque la hora estaba ocupada o fuera del horario.",
    );
  });
});

describe("seriesRhythm", () => {
  it("dice la frecuencia, el día y la hora de la serie", () => {
    expect(
      seriesRhythm({
        frequency: "biweekly",
        weekday: 6,
        startTime: "10:00:00",
        startsOn: "2026-11-07",
      }),
    ).toBe("Cada 15 días · sábados 10:00 a. m.");
    expect(
      seriesRhythm({
        frequency: "weekly",
        weekday: 2,
        startTime: "15:30",
        startsOn: "2026-11-03",
      }),
    ).toBe("Cada semana · martes 3:30 p. m.");
    expect(
      seriesRhythm({
        frequency: "weekly",
        weekday: 0,
        startTime: "12:05",
        startsOn: "2026-11-01",
      }),
    ).toBe("Cada semana · domingos 12:05 p. m.");
  });

  it("la mensual va el mismo día del mes, sin día de la semana", () => {
    expect(
      seriesRhythm({
        frequency: "monthly",
        weekday: 6,
        startTime: "00:00",
        startsOn: "2026-11-14",
      }),
    ).toBe("Cada mes · el día 14, 12:00 a. m.");
  });
});

describe("seriesLeft y deleteSeriesWarning", () => {
  it("cuentan las citas que faltan en singular, plural o ninguna", () => {
    expect(seriesLeft(6)).toBe("Quedan 6 citas");
    expect(seriesLeft(1)).toBe("Queda 1 cita");
    expect(seriesLeft(0)).toBe("No le quedan citas");
    expect(deleteSeriesWarning(6)).toBe(
      "Se cancelan las 6 citas que faltan. Las que ya pasaron se quedan.",
    );
    expect(deleteSeriesWarning(1)).toBe(
      "Se cancela la cita que falta. Las que ya pasaron se quedan.",
    );
    expect(deleteSeriesWarning(0)).toBe(
      "No le quedan citas por delante. Las que ya pasaron se quedan.",
    );
  });
});
