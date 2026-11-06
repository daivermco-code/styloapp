import Link from "next/link";
import { BusinessLogo } from "@/features/explore/components/business-logo";
import { formatShortDate } from "@/shared/lib/dates";
import type { MyBooking } from "../types/booking";

// Cuántos negocios muestra "Tus servicios recientes".
const RECENT_LIMIT = 3;

/** La cita efectiva más reciente de cada negocio, de la más nueva a la más vieja. */
export function recentServices(bookings: MyBooking[]): MyBooking[] {
  const seen = new Set<string>();
  return bookings
    .filter((booking) => booking.status === "successful")
    .filter((booking) => {
      if (seen.has(booking.business.id)) return false;
      seen.add(booking.business.id);
      return true;
    })
    .slice(0, RECENT_LIMIT);
}

// "Tus servicios recientes" del Inicio (US-030): después de calificar, el negocio de cada cita
// efectiva reciente, para volver a reservar.
export function RecentServices({ bookings }: { bookings: MyBooking[] }) {
  if (bookings.length === 0) return null;
  return (
    <section
      aria-labelledby="servicios-recientes"
      className="flex flex-col gap-3"
    >
      <h2 id="servicios-recientes" className="text-20 font-bold text-secondary">
        Tus servicios recientes
      </h2>
      <ul className="flex flex-col gap-3">
        {bookings.map((booking) => (
          <li key={booking.id}>
            <Link
              href={`/app/negocio/${booking.business.id}`}
              className="flex items-center gap-3 rounded-card bg-surface p-3 shadow-card transition-shadow duration-120 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <BusinessLogo
                name={booking.business.name}
                logoUrl={booking.business.logoUrl}
                size={48}
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-16 font-bold text-primary">
                  {booking.business.name}
                </span>
                <span className="truncate text-14 text-slate">
                  {booking.serviceName} · {formatShortDate(booking.startsAt)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
