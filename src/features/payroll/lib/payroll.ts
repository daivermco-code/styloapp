import { formatDayOfMonth } from "@/shared/lib/dates";
import { MONTH_NAMES } from "@/shared/lib/periods";

// Los textos del liquidador y del historial de pagos (US-045 y US-046); las cuentas las
// hace la base (payroll() y pay_staff). Puro: los días van como "YYYY-MM-DD" de Bogotá.

/** "1 servicio", "8 servicios". */
export function servicesText(count: number): string {
  return count === 1 ? "1 servicio" : `${count} servicios`;
}

/** "1 cita sin marcar", "2 citas sin marcar". */
export function unmarkedText(count: number): string {
  return count === 1 ? "1 cita sin marcar" : `${count} citas sin marcar`;
}

/** "1 factura", "3 facturas". */
export function invoicesText(count: number): string {
  return count === 1 ? "1 factura" : `${count} facturas`;
}

/** La línea de apoyo de la tarjeta: "8 servicios de 3 facturas · desde 20 oct". */
export function pendingSummary(
  items: number,
  invoices: number,
  since: string | null,
): string {
  const services = `${servicesText(items)} de ${invoicesText(invoices)}`;
  return since ? `${services} · desde ${formatDayOfMonth(since)}` : services;
}

/** "2026-11-01" → "Noviembre de 2026". */
export function monthTitle(day: string): string {
  const [year, month] = day.split("-").map(Number);
  const name = MONTH_NAMES[month - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${year}`;
}

export interface MonthGroup<T> {
  title: string;
  items: T[];
}

/** Agrupa por mes, en el orden en que llegan (el historial ya viene del más reciente al más viejo). */
export function groupByMonth<T extends { paidOn: string }>(
  items: T[],
): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const item of items) {
    const title = monthTitle(item.paidOn);
    const last = groups.at(-1);
    if (last?.title === title) last.items.push(item);
    else groups.push({ title, items: [item] });
  }
  return groups;
}
