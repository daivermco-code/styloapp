import { formatLongDate, formatTime } from "@/shared/lib/dates";
import type { MyBooking } from "../types/booking";

// Tarjeta de una cita del cliente para calificarla (US-030, captura 193): la inicial del
// profesional, el negocio, el servicio y la fecha y hora.
export function BookingSummaryCard({ booking }: { booking: MyBooking }) {
  return (
    <div className="flex items-center gap-4 rounded-card bg-soft p-4">
      <span
        aria-hidden
        className="flex size-[55px] shrink-0 items-center justify-center rounded-full bg-primary text-25 font-bold text-surface"
      >
        {booking.staffName.charAt(0).toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-col">
        <p className="truncate text-16 font-bold text-primary">
          {booking.business.name}
        </p>
        <p className="text-14 text-ink">
          {booking.serviceName} con {booking.staffName}
        </p>
        <p className="text-14 text-slate first-letter:uppercase">
          {formatLongDate(booking.startsAt)} · {formatTime(booking.startsAt)}
        </p>
      </div>
    </div>
  );
}
