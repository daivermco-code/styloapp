import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/shared/lib/dates";
import type { AgendaBooking } from "../types/agenda";
import { InstantLink } from "@/shared/components/instant-nav";
import { NAV_GROUP } from "@/shared/lib/instant-nav";

/** "9:45": en la grilla la posición ya dice si es de mañana o de tarde. */
function clock(value: string): string {
  return formatTime(value).replace(/ [ap]\. m\.$/, "");
}

interface BookingCardProps {
  booking: AgendaBooking;
  /** El detalle de la cita; sin él la tarjeta solo se ve (el modo de bloqueo). */
  href?: string;
  top: number;
  height: number;
}

// Tarjeta de cita en la grilla (UI pantalla 3, captura 11): relleno 200 con borde izquierdo de
// 4 px 400; la que reservó un cliente, relleno 100 con el ícono de persona. Las cortas dejan
// la hora y el cliente; las de 15 minutos, todo en una línea.
export function BookingCard({ booking, href, top, height }: BookingCardProps) {
  const fromClient = booking.bookedBy === "client";
  const compact = height < 56;
  const oneLine = height < 40;
  const className = cn(
    "absolute inset-x-1 z-[1] flex overflow-hidden rounded-booking border-l-4 border-primary-400 px-2 py-1 text-ink",
    fromClient ? "bg-primary-100" : "bg-primary-200",
    oneLine ? "items-center gap-1 py-0" : "flex-col",
    compact && !oneLine && "py-0.5",
  );
  const content = (
    <>
      <span className="flex items-center gap-1 text-12 leading-tight">
        {fromClient && (
          <>
            <UserRound className="size-3.5 shrink-0 text-primary" aria-hidden />
            <span className="sr-only">La reservó el cliente. </span>
          </>
        )}
        <span className={cn(oneLine ? "shrink-0" : "truncate")}>
          {oneLine
            ? clock(booking.startsAt)
            : `${clock(booking.startsAt)} - ${clock(booking.endsAt)}`}
        </span>
      </span>
      <span className="truncate text-14 font-bold leading-tight">
        {booking.clientName}
      </span>
      {!compact && (
        <span className="truncate text-12 leading-tight">
          {booking.serviceName}
        </span>
      )}
    </>
  );
  if (!href) {
    return (
      <div style={{ top, height }} className={className}>
        {content}
      </div>
    );
  }
  return (
    // Mide lo que dura la cita (15 minutos son 18 px): la prueba de 44 px no la cuenta, porque
    // el alto es la información (WCAG 2.5.8, excepción "esencial"). Se abre también desde la lista.
    <InstantLink
      href={href}
      group={NAV_GROUP.agendaBooking}
      selectable={false}
      push
      data-time-block
      style={{ top, height }}
      className={cn(
        className,
        "transition-shadow duration-120 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {content}
    </InstantLink>
  );
}
