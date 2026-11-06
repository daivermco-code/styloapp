export type TeamRole = "owner" | "staff";

/** Una persona del equipo en la lista de Equipo (US-012 y US-013). */
export interface TeamMember {
  id: string;
  displayName: string;
  role: TeamRole;
  isActive: boolean;
  /** Sin horario o sin servicios no sale para reservar (US-013). */
  hasHours: boolean;
  hasServices: boolean;
}

/** Un servicio activo del negocio visto desde un profesional: si lo hace y con qué duración. */
export interface StaffServiceOption {
  id: string;
  name: string;
  /** La duración general del servicio. */
  durationMinutes: number;
  assigned: boolean;
  /** La suya con este profesional; null = la del servicio. */
  ownDuration: number | null;
}

export interface StaffServiceCategory {
  id: string;
  name: string;
  services: StaffServiceOption[];
}

/** Un servicio que hace un profesional, con su precio y su comisión (US-037). */
export interface StaffPricingService {
  id: string;
  name: string;
  /** El precio general del servicio. */
  generalPrice: number;
  /** El suyo; null = el general. */
  ownPrice: number | null;
  /** La suya; vacía en la base = 50 %. */
  commissionPct: number;
}

export interface StaffPricingCategory {
  id: string;
  name: string;
  services: StaffPricingService[];
}

/** Los 5 permisos del equipo (US-038), iguales para todos los profesionales. */
export interface TeamPermissions {
  internalClients: boolean;
  invoicing: boolean;
  manualBooking: boolean;
  manualBlock: boolean;
  seeClientPhone: boolean;
}
