import { describe, expect, it } from "vitest";
import {
  groupByMonth,
  invoicesText,
  monthTitle,
  pendingSummary,
  servicesText,
  unmarkedText,
} from "@/features/payroll/lib/payroll";

describe("textos", () => {
  it("cuenta en singular y en plural", () => {
    expect(servicesText(1)).toBe("1 servicio");
    expect(servicesText(0)).toBe("0 servicios");
    expect(servicesText(8)).toBe("8 servicios");
    expect(unmarkedText(1)).toBe("1 cita sin marcar");
    expect(unmarkedText(2)).toBe("2 citas sin marcar");
    expect(invoicesText(1)).toBe("1 factura");
    expect(invoicesText(3)).toBe("3 facturas");
  });

  it("la línea de la tarjeta dice desde cuándo, si hay pendientes", () => {
    expect(pendingSummary(8, 3, "2026-10-20")).toBe(
      "8 servicios de 3 facturas · desde 20 oct",
    );
    expect(pendingSummary(1, 1, null)).toBe("1 servicio de 1 factura");
  });
});

describe("monthTitle", () => {
  it("nombra el mes y el año", () => {
    expect(monthTitle("2026-11-01")).toBe("Noviembre de 2026");
    expect(monthTitle("2027-01-31")).toBe("Enero de 2027");
    expect(monthTitle("2026-12-15")).toBe("Diciembre de 2026");
  });
});

describe("groupByMonth", () => {
  it("agrupa por mes en el orden en que llegan", () => {
    const payments = [
      { id: "1", paidOn: "2026-11-03" },
      { id: "2", paidOn: "2026-11-01" },
      { id: "3", paidOn: "2026-10-30" },
      { id: "4", paidOn: "2025-11-15" },
    ];
    expect(groupByMonth(payments)).toEqual([
      { title: "Noviembre de 2026", items: [payments[0], payments[1]] },
      { title: "Octubre de 2026", items: [payments[2]] },
      { title: "Noviembre de 2025", items: [payments[3]] },
    ]);
    expect(groupByMonth([])).toEqual([]);
  });
});
