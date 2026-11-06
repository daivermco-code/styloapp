// Reglas puras de Informes (T-12.2.1, US-052, US-053 y US-059): el rango de cada periodo y del
// rango propio, el periodo anterior, la variación, las utilidades y los filtros de la URL.
import { describe, expect, it } from "vitest";
import {
  methodShares,
  rangeLabel,
  reportsHref,
  variationText,
  variationTone,
} from "@/features/reports/lib/display";
import { parseReportView } from "@/features/reports/lib/filters";
import {
  generalSales,
  utilities,
  variation,
} from "@/features/reports/lib/numbers";
import {
  daysInRange,
  previousRange,
  type ReportFilters,
  reportRange,
} from "@/features/reports/lib/range";
import type { ReportSummary } from "@/features/reports/types/report";
import {
  MISSING_FROM,
  RANGE_TOO_LONG,
  reportRangeSchema,
  TO_BEFORE_FROM,
} from "@/features/reports/types/schemas";

const STAFF = "3f1c2b9a-6d4e-4f8a-9b2c-1a2b3c4d5e6f";

function filters(
  period: ReportFilters["period"],
  day: string,
  range: ReportFilters["range"] = null,
): ReportFilters {
  return { period, day, range };
}

function summary(changes: Partial<ReportSummary> = {}): ReportSummary {
  return {
    services: 0,
    products: 0,
    expenses: 0,
    commissions: 0,
    invoices: 0,
    ...changes,
  };
}

describe("rango de cada informe", () => {
  it("cuenta los días con los dos extremos", () => {
    expect(daysInRange({ from: "2026-10-01", to: "2026-10-15" })).toBe(15);
    expect(daysInRange({ from: "2026-11-06", to: "2026-11-06" })).toBe(1);
    expect(daysInRange({ from: "2026-01-01", to: "2026-12-31" })).toBe(365);
    expect(daysInRange({ from: "2028-01-01", to: "2028-12-31" })).toBe(366);
  });

  it("sin rango propio, es el periodo que contiene al día", () => {
    expect(reportRange(filters("dia", "2026-11-06"))).toEqual({
      from: "2026-11-06",
      to: "2026-11-06",
    });
    expect(reportRange(filters("semana", "2026-11-06"))).toEqual({
      from: "2026-11-02",
      to: "2026-11-08",
    });
    expect(reportRange(filters("quincena", "2026-11-20"))).toEqual({
      from: "2026-11-16",
      to: "2026-11-30",
    });
    expect(reportRange(filters("mes", "2026-11-06"))).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
    expect(reportRange(filters("ano", "2026-11-06"))).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });

  it("con un rango propio, manda el rango", () => {
    const range = { from: "2026-10-01", to: "2026-10-15" };
    expect(reportRange(filters("mes", "2026-11-06", range))).toEqual(range);
  });
});

describe("periodo anterior", () => {
  it("es el mismo tipo de periodo, justo antes", () => {
    expect(previousRange(filters("dia", "2026-11-01"))).toEqual({
      from: "2026-10-31",
      to: "2026-10-31",
    });
    // La semana del lunes 2 de noviembre: la de antes empieza el lunes 26 de octubre.
    expect(previousRange(filters("semana", "2026-11-06"))).toEqual({
      from: "2026-10-26",
      to: "2026-11-01",
    });
    expect(previousRange(filters("mes", "2026-03-31"))).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(previousRange(filters("ano", "2026-11-06"))).toEqual({
      from: "2025-01-01",
      to: "2025-12-31",
    });
  });

  it("la quincena de antes: la primera del mes viene de la segunda del mes anterior", () => {
    expect(previousRange(filters("quincena", "2026-11-10"))).toEqual({
      from: "2026-10-16",
      to: "2026-10-31",
    });
    expect(previousRange(filters("quincena", "2026-11-20"))).toEqual({
      from: "2026-11-01",
      to: "2026-11-15",
    });
    // Enero: la de antes es la segunda de diciembre del año anterior.
    expect(previousRange(filters("quincena", "2027-01-03"))).toEqual({
      from: "2026-12-16",
      to: "2026-12-31",
    });
    // Marzo: la segunda de febrero termina el 28 (o el 29 en los bisiestos).
    expect(previousRange(filters("quincena", "2028-03-01"))).toEqual({
      from: "2028-02-16",
      to: "2028-02-29",
    });
  });

  it("un rango se compara con el del mismo largo justo antes", () => {
    const range = { from: "2026-10-01", to: "2026-10-15" };
    expect(previousRange(filters("dia", "2026-11-06", range))).toEqual({
      from: "2026-09-16",
      to: "2026-09-30",
    });
    // Cruza el año.
    expect(
      previousRange(
        filters("dia", "2026-11-06", { from: "2026-01-01", to: "2026-01-10" }),
      ),
    ).toEqual({ from: "2025-12-22", to: "2025-12-31" });
  });
});

describe("variación", () => {
  it("sube y baja con su signo, redondeada a un entero", () => {
    expect(variation(1_120_000, 1_000_000)).toEqual({
      kind: "change",
      pct: 12,
    });
    expect(variation(920_000, 1_000_000)).toEqual({ kind: "change", pct: -8 });
    expect(variation(2, 3)).toEqual({ kind: "change", pct: -33 });
    expect(variation(0, 500_000)).toEqual({ kind: "change", pct: -100 });
  });

  it("0 % si los dos son 0 o si el cambio no llega a medio punto", () => {
    expect(variation(0, 0)).toEqual({ kind: "same" });
    expect(variation(500_000, 500_000)).toEqual({ kind: "same" });
    expect(variation(1_004_000, 1_000_000)).toEqual({ kind: "same" });
    expect(variation(996_000, 1_000_000)).toEqual({ kind: "same" });
  });

  it("Nuevo si antes era 0 y ahora no", () => {
    expect(variation(250_000, 0)).toEqual({ kind: "new" });
    expect(variation(-80_000, 0)).toEqual({ kind: "new" });
  });

  it("desde un número negativo, pasar a uno mayor es una subida", () => {
    expect(variation(50_000, -100_000)).toEqual({ kind: "change", pct: 150 });
    expect(variation(-150_000, -100_000)).toEqual({
      kind: "change",
      pct: -50,
    });
  });
});

describe("utilidades", () => {
  it("Ventas generales = servicios + productos", () => {
    expect(generalSales(summary({ services: 900_000, products: 0 }))).toBe(
      900_000,
    );
    expect(generalSales(summary({ services: 900_000, products: 50_000 }))).toBe(
      950_000,
    );
  });

  it("Ventas generales − Gastos − Pago de comisiones, con su signo", () => {
    expect(
      utilities(
        summary({
          services: 1_250_000,
          expenses: 430_000,
          commissions: 625_000,
        }),
      ),
    ).toBe(195_000);
    expect(
      utilities(
        summary({ services: 500_000, expenses: 330_000, commissions: 250_000 }),
      ),
    ).toBe(-80_000);
  });

  it("sin gastos (un profesional elegido), no los resta", () => {
    expect(
      utilities(
        summary({ services: 600_000, expenses: null, commissions: 300_000 }),
      ),
    ).toBe(300_000);
  });
});

describe("hoja Filtrar: Rango", () => {
  it("toma Desde y Hasta que existen, en orden y de hasta un año", () => {
    expect(
      reportRangeSchema.safeParse({ from: "2026-10-01", to: "2026-10-15" })
        .success,
    ).toBe(true);
    expect(
      reportRangeSchema.safeParse({ from: "2026-10-15", to: "2026-10-15" })
        .success,
    ).toBe(true);
    expect(
      reportRangeSchema.safeParse({ from: "2028-01-01", to: "2028-12-31" })
        .success,
    ).toBe(true);
  });

  it("dice qué falta y qué está mal", () => {
    const empty = reportRangeSchema.safeParse({ from: "", to: "2026-10-15" });
    expect(empty.error?.issues[0].message).toBe(MISSING_FROM);
    const backwards = reportRangeSchema.safeParse({
      from: "2026-10-15",
      to: "2026-10-01",
    });
    expect(backwards.error?.issues[0]).toMatchObject({
      message: TO_BEFORE_FROM,
      path: ["to"],
    });
    const tooLong = reportRangeSchema.safeParse({
      from: "2026-01-01",
      to: "2027-01-02",
    });
    expect(tooLong.error?.issues[0]).toMatchObject({
      message: RANGE_TOO_LONG,
      path: ["to"],
    });
    expect(
      reportRangeSchema.safeParse({ from: "2026-02-30", to: "2026-03-01" })
        .success,
    ).toBe(false);
  });
});

describe("filtros de la URL", () => {
  it("sin nada, Indicadores generales en el día de hoy, sin rango y con Todos", () => {
    expect(parseReportView({}, "2026-11-06", true)).toEqual({
      tab: "indicadores",
      period: "dia",
      day: "2026-11-06",
      range: null,
      staffId: null,
    });
  });

  it("el dueño: pestaña, periodo, rango y profesional", () => {
    expect(
      parseReportView(
        {
          pestana: "metodos",
          periodo: "quincena",
          dia: "2026-10-20",
          desde: "2026-10-01",
          hasta: "2026-10-15",
          pro: STAFF,
        },
        "2026-11-06",
        true,
      ),
    ).toEqual({
      tab: "metodos",
      period: "quincena",
      day: "2026-10-20",
      range: { from: "2026-10-01", to: "2026-10-15" },
      staffId: STAFF,
    });
  });

  it("lo que no se entiende queda en el valor de siempre", () => {
    expect(
      parseReportView(
        {
          pestana: "otra",
          periodo: "siglo",
          dia: "2026-13-01",
          desde: "2026-10-15",
          hasta: "2026-10-01",
          pro: "camilo",
        },
        "2026-11-06",
        true,
      ),
    ).toEqual({
      tab: "indicadores",
      period: "dia",
      day: "2026-11-06",
      range: null,
      staffId: null,
    });
    // Un rango a medias tampoco se toma.
    expect(
      parseReportView({ desde: "2026-10-01" }, "2026-11-06", true).range,
    ).toBeNull();
  });

  it("al profesional no le sirven ?pro= ni Métodos de pago", () => {
    const view = parseReportView(
      { pestana: "metodos", pro: STAFF },
      "2026-11-06",
      false,
    );
    expect(view.tab).toBe("indicadores");
    expect(view.staffId).toBeNull();
    expect(
      parseReportView({ pestana: "comisiones" }, "2026-11-06", false).tab,
    ).toBe("comisiones");
  });
});

describe("dirección de Informes", () => {
  const view = parseReportView({}, "2026-11-06", true);

  it("lleva periodo y día siempre, y lo demás solo si cambia", () => {
    expect(reportsHref(view)).toBe("/pro/informes?periodo=dia&dia=2026-11-06");
    expect(
      reportsHref(view, {
        tab: "comisiones",
        period: "mes",
        range: { from: "2026-10-01", to: "2026-10-15" },
        staffId: STAFF,
      }),
    ).toBe(
      `/pro/informes?pestana=comisiones&periodo=mes&dia=2026-11-06&desde=2026-10-01&hasta=2026-10-15&pro=${STAFF}`,
    );
  });

  it("lo que escribe se vuelve a leer igual", () => {
    const changed = {
      ...view,
      tab: "ventas" as const,
      range: { from: "2026-10-01", to: "2026-10-15" },
    };
    const search = new URL(reportsHref(changed), "http://localhost")
      .searchParams;
    expect(
      parseReportView(Object.fromEntries(search), "2026-11-06", true),
    ).toEqual(changed);
  });
});

describe("cómo se ve la variación", () => {
  it("subir es bueno en ventas y malo en gastos y comisiones", () => {
    const up = variation(120, 100);
    const down = variation(80, 100);
    expect(variationTone(up)).toBe("good");
    expect(variationTone(down)).toBe("bad");
    expect(variationTone(up, true)).toBe("bad");
    expect(variationTone(down, true)).toBe("good");
    expect(variationTone(variation(0, 0), true)).toBe("neutral");
    expect(variationTone(variation(5, 0))).toBe("new");
  });

  it("el texto lleva su signo", () => {
    expect(variationText({ kind: "change", pct: 12 })).toBe("+12 %");
    expect(variationText({ kind: "change", pct: -8 })).toBe("−8 %");
    expect(variationText({ kind: "same" })).toBe("0 %");
    expect(variationText({ kind: "new" })).toBe("Nuevo");
  });
});

describe("porcentajes de los métodos de pago", () => {
  it("suman 100, con el redondeo en la fila más grande", () => {
    expect(methodShares([750_000, 500_000])).toEqual([60, 40]);
    // 33,3 + 33,3 + 33,3: el que sobra va en el primero de los más grandes.
    expect(methodShares([100, 100, 100])).toEqual([34, 33, 33]);
    // 66,7 + 16,7 + 16,7 = 101 redondeado: se quita en el más grande.
    expect(methodShares([400, 100, 100])).toEqual([66, 17, 17]);
    expect(methodShares([0, 300])).toEqual([0, 100]);
  });

  it("sin ventas, todos en 0", () => {
    expect(methodShares([0, 0])).toEqual([0, 0]);
    expect(methodShares([])).toEqual([]);
  });
});

describe("fecha del rango", () => {
  it("con el año al final, y en los dos si cambia", () => {
    expect(rangeLabel({ from: "2026-10-01", to: "2026-10-15" })).toBe(
      "Del 1 oct al 15 oct de 2026",
    );
    expect(rangeLabel({ from: "2026-12-20", to: "2027-01-05" })).toBe(
      "Del 20 dic de 2026 al 5 ene de 2027",
    );
  });
});
