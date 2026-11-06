import type { GENDERS } from "@/features/auth/types/schemas";
import type { BookingStatus } from "../lib/profile";

export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Hombre",
  female: "Mujer",
  other: "Otro",
};

/** La ficha de un cliente (US-048). */
export interface ClientProfile {
  id: string;
  fullName: string;
  /** "+573005550201", o null si no tiene o no lo comparte. */
  phone: string | null;
  birthDate: string | null;
  gender: Gender | null;
  notes: string | null;
  whatsappOk: boolean;
  promosOk: boolean;
  isBlocked: boolean;
  /** Si reserva con su cuenta de la app de clientes. */
  hasAccount: boolean;
  /** El promedio de sus llegadas, si ya lo calificaron. */
  reputation: { score: number; count: number } | null;
}

export interface ClientBooking {
  id: string;
  startsAt: string;
  status: BookingStatus;
  serviceName: string;
  staffName: string;
}

export interface ClientInvoice {
  id: string;
  number: number;
  status: "paid" | "void";
  issuedOn: string;
  total: number;
  services: string[];
}
