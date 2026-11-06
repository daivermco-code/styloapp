import type { ReportRange, Variation } from "../types/report";
import { reportsHrefParams, type ReportView } from "./filters";

// Lo que la pantalla de Informes escribe y enlaza (UI anexo oleada 5, B.1 y Pantallas 19 a 21).

const SHORT_MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** La dirección de Informes con lo que se mira y los cambios encima. */
export function reportsHref(
  view: ReportView,
  changes: Partial<ReportView> = {},
): string {
  return `/pro/informes?${reportsHrefParams({ ...view, ...changes })}`;
}

/** Cómo se pinta la variación: buena o mala noticia, sin cambio, o "Nuevo". */
export type VariationTone = "good" | "bad" | "neutral" | "new";

/**
 * Subir es buena noticia en ventas y utilidades, y mala en Gastos y Pago de comisiones
 * (`risingIsBad`).
 */
export function variationTone(
  value: Variation,
  risingIsBad = false,
): VariationTone {
  if (value.kind === "same") return "neutral";
  if (value.kind === "new") return "new";
  return value.pct > 0 === risingIsBad ? "bad" : "good";
}

/** "+12 %", "−8 %", "0 %" o "Nuevo" (con el signo menos tipográfico). */
export function variationText(value: Variation): string {
  if (value.kind === "same") return "0 %";
  if (value.kind === "new") return "Nuevo";
  return value.pct > 0 ? `+${value.pct} %` : `−${-value.pct} %`;
}

/**
 * El porcentaje de cada método sobre el total, en enteros que suman 100: lo que falta o sobra
 * por el redondeo se ajusta en la fila más grande (US-056). Sin ventas, todos en 0.
 */
export function methodShares(totals: number[]): number[] {
  const sum = totals.reduce((acc, value) => acc + value, 0);
  if (sum === 0) return totals.map(() => 0);
  const shares = totals.map((value) => Math.round((value / sum) * 100));
  const largest = totals.indexOf(Math.max(...totals));
  shares[largest] += 100 - shares.reduce((acc, value) => acc + value, 0);
  return shares;
}

function shortDay(day: string, withYear: boolean): string {
  const [year, month, date] = day.split("-").map(Number);
  const text = `${date} ${SHORT_MONTHS[month - 1]}`;
  return withYear ? `${text} de ${year}` : text;
}

/** "Del 1 oct al 15 oct de 2026"; con el año en los dos si cambia. */
export function rangeLabel(range: ReportRange): string {
  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
  return `Del ${shortDay(range.from, !sameYear)} al ${shortDay(range.to, true)}`;
}
