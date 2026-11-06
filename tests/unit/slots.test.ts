import { describe, expect, it } from "vitest";
import {
  availableSlots,
  bookingEnd,
  type SlotQuery,
} from "@/features/agenda/lib/slots";

// Lunes 2 de noviembre de 2026, 8:00 a. m. en Bogotá (13:00 UTC).
const NOW = "2026-11-02T13:00:00Z";
const DAY = "2026-11-02";

function query(overrides: Partial<SlotQuery> = {}): SlotQuery {
  return {
    day: DAY,
    workRanges: [{ starts: "09:00", ends: "10:00" }],
    busy: [],
    durationMinutes: 30,
    intervalMinutes: 30,
    minNoticeMinutes: 0,
    maxAdvanceDays: null,
    now: NOW,
    ...overrides,
  };
}

/** Un instante de Bogotá (UTC−5) en ISO. */
function bogota(day: string, clock: string): string {
  return new Date(`${day}T${clock}:00-05:00`).toISOString();
}

describe("availableSlots", () => {
  it("ofrece las horas de un horario partido, sin la pausa", () => {
    const slots = availableSlots(
      query({
        workRanges: [
          { starts: "14:00", ends: "19:00" },
          { starts: "09:00", ends: "13:00" },
        ],
      }),
    );
    expect(slots).toHaveLength(18);
    expect(slots[0]).toBe("09:00");
    expect(slots).toContain("12:30");
    expect(slots).not.toContain("13:00");
    expect(slots).not.toContain("13:30");
    expect(slots).toContain("14:00");
    expect(slots.at(-1)).toBe("18:30");
  });

  it("no ofrece una hora si la cita no cabe entera en la franja", () => {
    expect(availableSlots(query({ durationMinutes: 45 }))).toEqual(["09:00"]);
    expect(availableSlots(query({ durationMinutes: 90 }))).toEqual([]);
  });

  it("sigue el intervalo del negocio: 15, 30 o 60 minutos", () => {
    expect(
      availableSlots(query({ intervalMinutes: 15, durationMinutes: 15 })),
    ).toEqual(["09:00", "09:15", "09:30", "09:45"]);
    expect(availableSlots(query({ intervalMinutes: 30 }))).toEqual([
      "09:00",
      "09:30",
    ]);
    expect(
      availableSlots(query({ intervalMinutes: 60, durationMinutes: 60 })),
    ).toEqual(["09:00"]);
  });

  it("salta lo ocupado (citas y bloqueos), pero deja las horas pegadas", () => {
    const busy = [
      { startsAt: bogota(DAY, "10:00"), endsAt: bogota(DAY, "10:30") },
    ];
    const workRanges = [{ starts: "09:00", ends: "12:00" }];
    expect(availableSlots(query({ workRanges, busy }))).toEqual([
      "09:00",
      "09:30",
      "10:30",
      "11:00",
      "11:30",
    ]);
    expect(
      availableSlots(query({ workRanges, busy, durationMinutes: 45 })),
    ).toEqual(["09:00", "10:30", "11:00"]);
  });

  it("respeta la antelación mínima y no ofrece horas que ya pasaron", () => {
    // 9:10 a. m. en Bogotá.
    const now = bogota(DAY, "09:10");
    const workRanges = [{ starts: "09:00", ends: "12:00" }];
    expect(availableSlots(query({ workRanges, now }))[0]).toBe("09:30");
    expect(
      availableSlots(query({ workRanges, now, minNoticeMinutes: 60 }))[0],
    ).toBe("10:30");
  });

  it("no ofrece días más allá de los días máximos", () => {
    expect(
      availableSlots(query({ day: "2026-11-09", maxAdvanceDays: 7 })),
    ).toEqual(["09:00", "09:30"]);
    expect(
      availableSlots(query({ day: "2026-11-10", maxAdvanceDays: 7 })),
    ).toEqual([]);
  });

  it("no ofrece horas en un día que ya pasó", () => {
    expect(availableSlots(query({ day: "2026-11-01" }))).toEqual([]);
  });

  it("cuenta los días con la medianoche de Bogotá, no la de UTC", () => {
    // 11:30 p. m. del lunes en Bogotá: en UTC ya es martes.
    const now = "2026-11-03T04:30:00Z";
    const late = [{ starts: "23:00", ends: "24:00" }];
    expect(availableSlots(query({ workRanges: late, now }))).toEqual(["23:30"]);
    expect(
      availableSlots(query({ day: "2026-11-03", now, maxAdvanceDays: 0 })),
    ).toEqual([]);
  });
});

describe("bookingEnd", () => {
  it("suma la duración al inicio", () => {
    expect(bookingEnd("2026-11-02T14:00:00.000Z", 45)).toBe(
      "2026-11-02T14:45:00.000Z",
    );
  });
});
