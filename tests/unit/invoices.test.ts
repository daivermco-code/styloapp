import { describe, expect, it } from "vitest";
import {
  arrangeInvoices,
  invoicesHref,
  type InvoiceView,
  parseInvoiceView,
} from "@/features/invoices/lib/filters";
import {
  type InvoiceLine,
  invoiceTitle,
  periodTotals,
  summarizeLines,
} from "@/features/invoices/lib/totals";

// T-8.2.1 (US-042): las cuentas y el orden de la lista de facturas.
const CAMILO = "camilo";
const SOFIA = "sofia";
const LINES: InvoiceLine[] = [
  {
    staffId: CAMILO,
    serviceName: "Corte clásico",
    price: 25000,
    commission: 12500,
  },
  { staffId: SOFIA, serviceName: "Barba", price: 15000, commission: 6000 },
];

describe("summarizeLines", () => {
  it("suma todos los servicios cuando se mira a todo el equipo", () => {
    expect(summarizeLines(LINES, null)).toEqual({
      value: 40000,
      commission: 18500,
      services: ["Corte clásico", "Barba"],
    });
  });

  it("suma solo los del profesional elegido", () => {
    expect(summarizeLines(LINES, SOFIA)).toEqual({
      value: 15000,
      commission: 6000,
      services: ["Barba"],
    });
    expect(summarizeLines(LINES, "otro")).toEqual({
      value: 0,
      commission: 0,
      services: [],
    });
  });
});

describe("periodTotals", () => {
  it("suma ventas y comisiones sin las anuladas", () => {
    expect(
      periodTotals([
        { status: "paid", value: 40000, commission: 20000 },
        { status: "void", value: 90000, commission: 45000 },
        { status: "paid", value: 25000, commission: 12500 },
      ]),
    ).toEqual({ sales: 65000, commissions: 32500 });
    expect(periodTotals([])).toEqual({ sales: 0, commissions: 0 });
  });
});

describe("invoiceTitle", () => {
  it("escribe el número con cuatro cifras", () => {
    expect(invoiceTitle(12)).toBe("Factura 0012");
    expect(invoiceTitle(12345)).toBe("Factura 12345");
  });
});

const VIEW: InvoiceView = {
  period: "dia",
  day: "2026-11-01",
  staffId: null,
  filter: null,
  order: "reciente",
};

describe("parseInvoiceView", () => {
  it("sin nada en la URL mira el día de hoy, todas, la más reciente primero", () => {
    expect(parseInvoiceView({}, "2026-11-01")).toEqual(VIEW);
  });

  it("lee el periodo, el día, el profesional, el filtro y el orden", () => {
    expect(
      parseInvoiceView(
        {
          periodo: "quincena",
          dia: "2026-10-20",
          pro: CAMILO,
          filtro: "anuladas",
          orden: "menor",
        },
        "2026-11-01",
      ),
    ).toEqual({
      period: "quincena",
      day: "2026-10-20",
      staffId: CAMILO,
      filter: "anuladas",
      order: "menor",
    });
  });

  it("descarta lo que no entiende", () => {
    expect(
      parseInvoiceView(
        {
          periodo: "hora",
          dia: "2026-02-30",
          pro: "",
          filtro: "x",
          orden: "y",
        },
        "2026-11-01",
      ),
    ).toEqual(VIEW);
  });
});

describe("invoicesHref", () => {
  it("lleva siempre el periodo y el día, y lo demás solo si cambia", () => {
    expect(invoicesHref(VIEW)).toBe("/pro/facturas?periodo=dia&dia=2026-11-01");
    expect(
      invoicesHref(VIEW, { staffId: SOFIA, filter: "pagadas", order: "mayor" }),
    ).toBe(
      "/pro/facturas?periodo=dia&dia=2026-11-01&pro=sofia&filtro=pagadas&orden=mayor",
    );
  });
});

describe("arrangeInvoices", () => {
  const list = [
    {
      number: 10,
      issuedOn: "2026-10-30",
      status: "paid" as const,
      value: 25000,
    },
    {
      number: 12,
      issuedOn: "2026-11-01",
      status: "void" as const,
      value: 40000,
    },
    {
      number: 11,
      issuedOn: "2026-11-01",
      status: "paid" as const,
      value: 25000,
    },
  ];
  const numbers = (items: { number: number }[]) => items.map((i) => i.number);

  it("ordena por fecha y número", () => {
    expect(numbers(arrangeInvoices(list, null, "reciente"))).toEqual([
      12, 11, 10,
    ]);
    expect(numbers(arrangeInvoices(list, null, "lejana"))).toEqual([
      10, 11, 12,
    ]);
  });

  it("ordena por valor y desempata con la más nueva", () => {
    expect(numbers(arrangeInvoices(list, null, "mayor"))).toEqual([12, 11, 10]);
    expect(numbers(arrangeInvoices(list, null, "menor"))).toEqual([11, 10, 12]);
  });

  it("filtra pagadas y anuladas sin cambiar la lista original", () => {
    expect(numbers(arrangeInvoices(list, "pagadas", "reciente"))).toEqual([
      11, 10,
    ]);
    expect(numbers(arrangeInvoices(list, "anuladas", "reciente"))).toEqual([
      12,
    ]);
    expect(numbers(list)).toEqual([10, 12, 11]);
  });
});
