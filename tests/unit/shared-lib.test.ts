import { describe, expect, it } from "vitest";
import {
  addDays,
  bogotaDateTime,
  formatDayMonth,
  formatLongDate,
  formatShortDate,
  formatTime,
  minutesBetween,
  todayInBogota,
  weekdayOf,
} from "@/shared/lib/dates";
import { formatCOP } from "@/shared/lib/money";
import {
  formatPhone,
  isColombianMobile,
  localDigits,
  normalizePhone,
  toAuthPhone,
} from "@/shared/lib/phone";

// Bogotá es UTC-5 todo el año (no cambia de horario).
describe("dates", () => {
  it("toma el día de hoy en Bogotá, no en UTC", () => {
    expect(todayInBogota("2026-11-01T03:00:00Z")).toBe("2026-10-31");
    expect(todayInBogota("2026-11-01T05:30:00Z")).toBe("2026-11-01");
  });

  it("escribe la hora como en Colombia", () => {
    expect(formatTime("2026-10-31T16:00:00Z")).toBe("11:00 a. m.");
    expect(formatTime("2026-10-31T20:30:00Z")).toBe("3:30 p. m.");
    expect(formatTime("2026-10-31T05:00:00Z")).toBe("12:00 a. m.");
    expect(formatTime("2026-10-31T17:00:00Z")).toBe("12:00 p. m.");
    expect(formatTime("2026-10-31T14:05:00Z")).toBe("9:05 a. m.");
  });

  it("escribe la fecha larga en español", () => {
    expect(formatLongDate("2026-10-31T16:00:00Z")).toBe(
      "sábado, 31 de octubre de 2026",
    );
    // A las 9 p. m. de Bogotá ya es otro día en UTC.
    expect(formatLongDate("2026-11-01T02:00:00Z")).toBe(
      "sábado, 31 de octubre de 2026",
    );
  });

  it("escribe la fecha corta sin puntos", () => {
    expect(formatShortDate("2026-10-31T16:00:00Z")).toBe("sáb 31 oct");
    expect(formatShortDate("2026-11-02T16:00:00Z")).toBe("lun 2 nov");
  });

  it("escribe el día y el mes cortos, en Bogotá", () => {
    expect(formatDayMonth("2026-11-01T16:00:00Z")).toBe("1 nov");
    expect(formatDayMonth("2026-12-01T03:00:00Z")).toBe("30 nov");
  });

  it("convierte un día y una hora de Bogotá en un instante", () => {
    expect(bogotaDateTime("2026-10-31", "11:00").toISOString()).toBe(
      "2026-10-31T16:00:00.000Z",
    );
    expect(bogotaDateTime("2026-12-31", "21:30").toISOString()).toBe(
      "2027-01-01T02:30:00.000Z",
    );
  });

  it("cuenta los minutos entre dos instantes", () => {
    expect(minutesBetween("2026-10-31T16:00:00Z", "2026-10-31T16:10:00Z")).toBe(
      10,
    );
    expect(minutesBetween("2026-10-31T16:10:00Z", "2026-10-31T16:00:00Z")).toBe(
      -10,
    );
  });
});

describe("días como texto", () => {
  it("mueve un día y cruza meses y años", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("da el día de la semana sin depender de la zona del equipo", () => {
    expect(weekdayOf("2026-10-31")).toBe(6);
    expect(weekdayOf("2026-11-01")).toBe(0);
  });
});

describe("money", () => {
  it("escribe pesos sin decimales y con punto de miles", () => {
    expect(formatCOP(25000)).toBe("$ 25.000");
    expect(formatCOP(1250000)).toBe("$ 1.250.000");
    expect(formatCOP(999)).toBe("$ 999");
    expect(formatCOP(0)).toBe("$ 0");
  });

  it("redondea los decimales y marca los negativos", () => {
    expect(formatCOP(25000.6)).toBe("$ 25.001");
    expect(formatCOP(-5000)).toBe("-$ 5.000");
  });
});

describe("phone", () => {
  it("normaliza el celular con o sin indicativo", () => {
    expect(normalizePhone("3005550101")).toBe("+573005550101");
    expect(normalizePhone("+573005550101")).toBe("+573005550101");
    expect(normalizePhone("573005550101")).toBe("+573005550101");
    expect(normalizePhone("300 555 0101")).toBe("+573005550101");
    expect(normalizePhone("+57 300-555-0101")).toBe("+573005550101");
  });

  it("rechaza lo que no es un celular colombiano", () => {
    expect(normalizePhone("2005550101")).toBeNull();
    expect(normalizePhone("30055501")).toBeNull();
    expect(normalizePhone("30055501011")).toBeNull();
    expect(normalizePhone("+13005550101")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(isColombianMobile("3005550101")).toBe(true);
    expect(isColombianMobile("6015550101")).toBe(false);
  });

  it("muestra el celular con espacios", () => {
    expect(formatPhone("+573005550101")).toBe("+57 300 555 0101");
    expect(formatPhone("3001234567")).toBe("+57 300 123 4567");
    expect(formatPhone("abc")).toBe("abc");
  });

  it("da los dígitos locales y el formato de Supabase Auth", () => {
    expect(localDigits("+573005550101")).toBe("3005550101");
    expect(toAuthPhone("3005550101")).toBe("573005550101");
    expect(localDigits("123")).toBeNull();
    expect(toAuthPhone("123")).toBeNull();
  });
});
