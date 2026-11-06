import { describe, expect, it } from "vitest";
import {
  clientNumbers,
  contactLine,
  lastVisitText,
} from "@/features/clients/lib/profile";
import {
  BIRTH_FUTURE,
  BIRTH_INVALID,
  NAME_LENGTH,
  NAME_REQUIRED,
  NOTES_LENGTH,
  PHONE_INVALID,
  saveClientSchema,
} from "@/features/clients/types/schemas";

// T-10.1.3 (US-048): los 3 números de la ficha y las reglas del editor de cliente.
const TODAY = "2026-11-05";

describe("clientNumbers", () => {
  it("cuenta solo las citas efectivas y los días desde la última, en días de Bogotá", () => {
    const numbers = clientNumbers(
      [
        // 11:30 p. m. del 1 de noviembre en Bogotá: ya es el 2 en UTC, pero cuenta el 1.
        { startsAt: "2026-11-02T04:30:00Z", status: "successful" },
        { startsAt: "2026-10-20T15:00:00Z", status: "successful" },
        { startsAt: "2026-11-04T15:00:00Z", status: "unsuccessful" },
        { startsAt: "2026-11-20T15:00:00Z", status: "pending" },
        { startsAt: "2026-11-03T15:00:00Z", status: "cancelled" },
      ],
      [
        { status: "paid", total: 38_000 },
        { status: "void", total: 99_000 },
        { status: "paid", total: 25_000 },
      ],
      TODAY,
    );
    expect(numbers).toEqual({ visits: 2, daysAway: 4, invoiced: 63_000 });
  });

  it("sin citas efectivas no hay última visita", () => {
    expect(clientNumbers([], [], TODAY)).toEqual({
      visits: 0,
      daysAway: null,
      invoiced: 0,
    });
  });

  it("cuenta los días aunque cruce el fin de año", () => {
    expect(
      clientNumbers(
        [{ startsAt: "2026-12-30T15:00:00Z", status: "successful" }],
        [],
        "2027-01-02",
      ).daysAway,
    ).toBe(3);
  });
});

describe("lastVisitText", () => {
  it("dice hoy, en singular o en plural, o una raya", () => {
    expect(lastVisitText(null)).toBe("—");
    expect(lastVisitText(0)).toBe("Hoy");
    expect(lastVisitText(1)).toBe("1 día");
    expect(lastVisitText(15)).toBe("15 días");
  });
});

describe("contactLine", () => {
  it("junta el celular y el cumpleaños con lo que haya", () => {
    expect(contactLine("+573005550201", "1995-03-14")).toBe(
      "+57 300 555 0201 · cumple el 14 mar",
    );
    expect(contactLine("+573005550201", null)).toBe("+57 300 555 0201");
    expect(contactLine(null, "1995-03-14")).toBe("cumple el 14 mar");
    expect(contactLine(null, null)).toBeNull();
  });
});

describe("saveClientSchema", () => {
  const schema = saveClientSchema(TODAY);
  const base = {
    fullName: "Lucía Herrera",
    birthDate: null,
    gender: null,
    notes: "",
    whatsappOk: true,
    promosOk: false,
  };
  const firstMessage = (input: object) => {
    const result = schema.safeParse({ ...base, ...input });
    return result.success ? null : result.error.issues[0].message;
  };

  it("acepta lo mínimo: el nombre, sin tocar el celular y con las notas vacías en null", () => {
    const result = schema.parse({ ...base, fullName: "  Lucía Herrera " });
    expect(result.fullName).toBe("Lucía Herrera");
    expect(result.phone).toBeUndefined();
    expect(result.notes).toBeNull();
  });

  it("el nombre va de 2 a 80 letras", () => {
    expect(firstMessage({ fullName: "  " })).toBe(NAME_REQUIRED);
    expect(firstMessage({ fullName: "L" })).toBe(NAME_LENGTH);
    expect(firstMessage({ fullName: "L".repeat(81) })).toBe(NAME_LENGTH);
  });

  it("el celular: vacío lo quita, 10 dígitos que empiezan por 3 lo ponen, lo demás no", () => {
    expect(schema.parse({ ...base, phone: " " }).phone).toBeNull();
    expect(schema.parse({ ...base, phone: "3005550201" }).phone).toBe(
      "+573005550201",
    );
    expect(firstMessage({ phone: "2005550201" })).toBe(PHONE_INVALID);
    expect(firstMessage({ phone: "300555" })).toBe(PHONE_INVALID);
  });

  it("la fecha de nacimiento existe, no es de antes de 1900 y no es después de hoy", () => {
    expect(schema.parse({ ...base, birthDate: TODAY }).birthDate).toBe(TODAY);
    expect(firstMessage({ birthDate: "2026-11-06" })).toBe(BIRTH_FUTURE);
    expect(firstMessage({ birthDate: "1995-02-30" })).toBe(BIRTH_INVALID);
    expect(firstMessage({ birthDate: "1899-12-31" })).toBe(BIRTH_INVALID);
  });

  it("el género es uno de la lista y las notas van hasta 500", () => {
    expect(schema.parse({ ...base, gender: "female" }).gender).toBe("female");
    expect(firstMessage({ gender: "x" })).not.toBeNull();
    expect(firstMessage({ notes: "a".repeat(501) })).toBe(NOTES_LENGTH);
    expect(schema.parse({ ...base, notes: " Prefiere tijera. " }).notes).toBe(
      "Prefiere tijera.",
    );
  });
});
