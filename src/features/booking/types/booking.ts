/** Una cita del cliente para Mis Reservas, el Inicio y calificar (US-028 y US-030). */
export interface MyBooking {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "pending" | "successful" | "unsuccessful" | "cancelled";
  /** La llegada: 5 a tiempo, 3 tarde, 1 no llegó; null sin marcar. */
  punctuality: number | null;
  price: number;
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  business: {
    id: string;
    name: string;
    address: string;
    neighborhood: string | null;
    city: string;
    logoUrl: string | null;
    /** Hasta cuántos minutos antes el cliente puede cambiarla o cancelarla. */
    cancelLimitMinutes: number;
  };
  /** Si ya tiene la reseña del cliente. */
  reviewed: boolean;
}
