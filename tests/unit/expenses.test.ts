import { describe, expect, it } from "vitest";
import {
  expensesHref,
  expensesTotal,
  parseExpenseView,
} from "@/features/expenses/lib/view";
import {
  AMOUNT_POSITIVE,
  AMOUNT_REQUIRED,
  CATEGORY_REQUIRED,
  DATE_FUTURE,
  DATE_REQUIRED,
  NAME_LENGTH,
  NAME_REQUIRED,
  saveExpenseSchema,
} from "@/features/expenses/types/schemas";
import { formatDayOfMonth } from "@/shared/lib/dates";

// T-9.1.1 (US-044): lo que se mira en Gastos, su total y las reglas del editor.
const TODAY = "2026-11-05";

describe("parseExpenseView", () => {
  it("sin nada en la URL, abre en el mes de hoy", () => {
    expect(parseExpenseView({}, TODAY)).toEqual({ period: "mes", day: TODAY });
  });

  it("toma Día y Semana con su día", () => {
    expect(
      parseExpenseView({ periodo: "semana", dia: "2026-10-28" }, TODAY),
    ).toEqual({ period: "semana", day: "2026-10-28" });
    expect(parseExpenseView({ periodo: "dia" }, TODAY).period).toBe("dia");
  });

  it("los periodos de Facturas que no son de Gastos y los días que no existen vuelven a lo de siempre", () => {
    expect(
      parseExpenseView({ periodo: "quincena", dia: "2026-02-30" }, TODAY),
    ).toEqual({ period: "mes", day: TODAY });
    expect(parseExpenseView({ periodo: "ano" }, TODAY).period).toBe("mes");
  });
});

describe("expensesHref y expensesTotal", () => {
  it("la dirección lleva el periodo y el día", () => {
    expect(expensesHref({ period: "dia", day: "2026-11-01" })).toBe(
      "/pro/gastos?periodo=dia&dia=2026-11-01",
    );
  });

  it("suma los valores; sin gastos es 0", () => {
    expect(expensesTotal([])).toBe(0);
    expect(expensesTotal([{ amount: 2_500_000 }, { amount: 380_000 }])).toBe(
      2_880_000,
    );
  });
});

describe("saveExpenseSchema", () => {
  const schema = saveExpenseSchema(TODAY);
  const valid = {
    name: "  Arriendo de noviembre ",
    category: "rent",
    paidOn: TODAY,
    amount: 2_500_000,
  };
  const messageOf = (input: Record<string, unknown>) => {
    const result = schema.safeParse(input);
    return result.success ? null : result.error.issues[0].message;
  };

  it("deja pasar un gasto completo, sin método y con el nombre recortado", () => {
    const result = schema.safeParse(valid);
    expect(result.success && result.data.name).toBe("Arriendo de noviembre");
    expect(result.success && result.data.paymentMethodId).toBeUndefined();
  });

  it("cada obligatorio dice qué falta", () => {
    expect(messageOf({ ...valid, name: "   " })).toBe(NAME_REQUIRED);
    expect(messageOf({ ...valid, name: "A" })).toBe(NAME_LENGTH);
    expect(messageOf({ ...valid, name: "x".repeat(61) })).toBe(NAME_LENGTH);
    expect(messageOf({ ...valid, category: undefined })).toBe(
      CATEGORY_REQUIRED,
    );
    expect(messageOf({ ...valid, category: "food" })).toBe(CATEGORY_REQUIRED);
    expect(messageOf({ ...valid, paidOn: undefined })).toBe(DATE_REQUIRED);
    expect(messageOf({ ...valid, amount: undefined })).toBe(AMOUNT_REQUIRED);
  });

  it("la fecha es un día de verdad y no va después de hoy", () => {
    expect(messageOf({ ...valid, paidOn: "2026-02-30" })).toBe(DATE_REQUIRED);
    expect(messageOf({ ...valid, paidOn: "5/11/2026" })).toBe(DATE_REQUIRED);
    expect(messageOf({ ...valid, paidOn: "2026-11-06" })).toBe(DATE_FUTURE);
    expect(messageOf({ ...valid, paidOn: "2025-12-31" })).toBeNull();
  });

  it("el valor es mayor que 0 y sin decimales", () => {
    expect(messageOf({ ...valid, amount: 0 })).toBe(AMOUNT_POSITIVE);
    expect(messageOf({ ...valid, amount: 1500.5 })).toBe(AMOUNT_POSITIVE);
    expect(messageOf({ ...valid, amount: 1 })).toBeNull();
  });

  it("el método, si viene, es un id", () => {
    expect(messageOf({ ...valid, paymentMethodId: "efectivo" })).not.toBeNull();
  });
});

describe("formatDayOfMonth", () => {
  it("un día de Bogotá no se corre al anterior", () => {
    expect(formatDayOfMonth("2026-11-01")).toBe("1 nov");
    expect(formatDayOfMonth("2026-12-31")).toBe("31 dic");
  });
});
