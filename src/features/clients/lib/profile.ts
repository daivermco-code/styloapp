import { todayInBogota } from "@/shared/lib/dates";
import { formatPhone } from "@/shared/lib/phone";
import { birthdayText } from "./tabs";

// La ficha del cliente (US-048, pantalla 15): sus 3 números salen de sus citas y sus facturas,
// con las mismas reglas que `client_stats` usa en la lista.

export type BookingStatus =
  "pending" | "successful" | "unsuccessful" | "cancelled";

export interface ProfileBooking {
  startsAt: string;
  status: BookingStatus;
}

export interface ProfileInvoice {
  status: "paid" | "void";
  total: number;
}

export interface ClientNumbers {
  /** Citas efectivas. */
  visits: number;
  /** Días desde la última cita efectiva (en días de Bogotá), o null si no tiene ninguna. */
  daysAway: number | null;
  /** Lo facturado: solo las facturas pagadas. */
  invoiced: number;
}

function dayNumber(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date) / 86_400_000;
}

/** Visitas, días desde la última y lo facturado. */
export function clientNumbers(
  bookings: ProfileBooking[],
  invoices: ProfileInvoice[],
  today: string,
): ClientNumbers {
  const visits = bookings
    .filter((booking) => booking.status === "successful")
    .map((booking) => todayInBogota(booking.startsAt))
    .sort();
  const last = visits.at(-1);
  return {
    visits: visits.length,
    daysAway: last === undefined ? null : dayNumber(today) - dayNumber(last),
    invoiced: invoices
      .filter((invoice) => invoice.status === "paid")
      .reduce((sum, invoice) => sum + invoice.total, 0),
  };
}

/** "Hoy", "1 día", "15 días", o una raya si nunca ha venido. */
export function lastVisitText(daysAway: number | null): string {
  if (daysAway === null) return "—";
  if (daysAway === 0) return "Hoy";
  return `${daysAway} ${daysAway === 1 ? "día" : "días"}`;
}

/** "+57 300 555 0201 · cumple el 14 mar", con lo que haya, o null. */
export function contactLine(
  phone: string | null,
  birthDate: string | null,
): string | null {
  const parts = [
    phone ? formatPhone(phone) : null,
    birthDate ? `cumple el ${birthdayText(birthDate)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
