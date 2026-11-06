import type { ReportSummary, Variation } from "../types/report";

// Las cuentas de los Indicadores generales (Tech Spec O5.4, PDR B.5).

/**
 * (actual − anterior) ÷ anterior, redondeada a un entero. Si los dos son 0, o el cambio
 * redondeado es 0, es "same" (0 % con el círculo neutro); si antes era 0 y ahora no, "new". Se
 * divide por el valor absoluto de lo anterior: Utilidades puede venir de un número negativo, y
 * pasar de −$ 100.000 a $ 50.000 es una subida.
 */
export function variation(current: number, previous: number): Variation {
  if (previous === 0) {
    return current === 0 ? { kind: "same" } : { kind: "new" };
  }
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  return pct === 0 ? { kind: "same" } : { kind: "change", pct };
}

/** Ventas generales: servicios + productos. */
export function generalSales(summary: ReportSummary): number {
  return summary.services + summary.products;
}

/** Utilidades = Ventas generales − Gastos − Pago de comisiones. Puede ser negativa. */
export function utilities(summary: ReportSummary): number {
  return generalSales(summary) - (summary.expenses ?? 0) - summary.commissions;
}
