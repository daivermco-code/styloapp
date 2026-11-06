import type { Database } from "@/shared/types/database";
import type { GridRange } from "../lib/grid";
import type { SeriesDateStatus } from "../lib/recurring";

export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type BookedBy = Database["public"]["Enums"]["booked_by"];

/** Quién mira la agenda: el dueño ve todo el negocio; el profesional, solo su columna. */
export interface AgendaViewer {
  businessId: string;
  side: "owner" | "staff";
  /** Su fila en staff. */
  staffId: string;
  /** El dueño siempre; el profesional, con el permiso `manual_booking`. */
  canBook: boolean;
  /** El dueño siempre; el profesional, con el permiso `internal_clients`. */
  canCreateClients: boolean;
  /** El dueño siempre; el profesional, con el permiso `manual_block` (solo en su columna). */
  canBlock: boolean;
  /** El dueño siempre; el profesional, con el permiso `invoicing` (US-041). */
  canInvoice: boolean;
}

/** Una columna de la grilla: un profesional (o el dueño, si atiende). */
export interface AgendaColumn {
  id: string;
  name: string;
  isOwner: boolean;
}

export interface AgendaBooking {
  id: string;
  staffId: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  bookedBy: BookedBy;
  /** El cliente de la ficha, el nombre del cliente de paso o "Sin cliente". */
  clientName: string;
  serviceName: string;
}

export interface AgendaBlock {
  id: string;
  staffId: string;
  startsAt: string;
  endsAt: string;
}

export interface AgendaDay {
  day: string;
  columns: AgendaColumn[];
  /** Las del día sin las canceladas, en orden. */
  bookings: AgendaBooking[];
  blocks: AgendaBlock[];
  /** Null si el negocio no atiende ese día y no hay nada en la agenda. */
  range: GridRange | null;
}

/** Quien puede hacer un servicio en el editor, con su duración y su precio propios. */
export interface BookingStaffOption {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
}

export interface BookingServiceOption {
  id: string;
  name: string;
  /** "$ 25.000", "Desde $ 25.000"… */
  priceLabel: string;
  durationMinutes: number;
  staff: BookingStaffOption[];
}

export interface BookingCategoryOption {
  id: string;
  name: string;
  services: BookingServiceOption[];
}

/** Ficha de cliente para el buscador (el celular solo si quien mira puede verlo). */
export interface AgendaClient {
  id: string;
  fullName: string;
  phone: string | null;
  hasAccount: boolean;
  isBlocked: boolean;
}

/** Una cita cargada en el editor para modificarla. */
export interface EditableBooking {
  id: string;
  staffId: string;
  serviceId: string;
  day: string;
  time: string;
  durationMinutes: number;
  clientId: string | null;
  /** El cliente de la ficha o el de paso. */
  clientName: string;
  guestName: string | null;
}

/** El detalle de una cita (US-018 y US-019), con lo que quien mira puede hacer. */
export interface BookingDetail {
  id: string;
  day: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  bookedBy: BookedBy;
  clientName: string;
  serviceName: string;
  staffName: string;
  price: number;
  note: string | null;
  punctuality: number | null;
  /** Solo si quien mira puede verlo (`client_phone`). */
  clientPhone: string | null;
  /** Promedio de llegadas del cliente con cuenta; null sin calificaciones o sin cuenta. */
  reputation: { score: number; count: number } | null;
  started: boolean;
  canModify: boolean;
  canCancel: boolean;
  /** Por qué no sale Modificar o Cancelar, si aplica. */
  lockedReason: string | null;
  /** La ficha del cliente, si la hay. */
  clientId: string | null;
  clientBlocked: boolean;
  /** "Bloquear usuario" (US-020): solo el dueño, en citas que reservó el cliente. */
  canBlockClient: boolean;
  /** La cita es de una serie (US-022): cancelar pregunta si solo esta o también las siguientes. */
  inSeries: boolean;
  /** "Generar factura" y "Factura rápida" (US-041): el dueño, o el profesional con el permiso. */
  canInvoice: boolean;
  /** Su factura pagada, si ya la tiene y quien mira la puede ver ("Ver factura 0012"). */
  invoice: { id: string; number: number } | null;
  /**
   * Tiene factura pagada, la vea o no quien mira (booking_is_invoiced): si el dueño la facturó solo
   * con servicios de otro, el profesional no la ve y le sale "Esta cita ya tiene su factura.".
   */
  invoiced: boolean;
}

/** Una fecha de la serie en "Repetir esta cita", con si se puede crear. */
export interface SeriesDate {
  day: string;
  status: SeriesDateStatus;
}
