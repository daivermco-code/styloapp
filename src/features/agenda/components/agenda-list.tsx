import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/components/empty-state";
import { formatTime } from "@/shared/lib/dates";
import type { AgendaDay } from "../types/agenda";
import { EMPTY_DAY_OWNER, EMPTY_DAY_STAFF } from "../types/messages";
import { InstantLink } from "@/shared/components/instant-nav";
import { NAV_GROUP } from "@/shared/lib/instant-nav";

interface AgendaListProps {
  agenda: AgendaDay;
  side: "owner" | "staff";
}

// Vista de lista (US-015, captura 169): las citas del día en orden, con la hora, el cliente, el
// servicio y, para el dueño, el profesional. Cada una abre su detalle.
export function AgendaList({ agenda, side }: AgendaListProps) {
  if (agenda.bookings.length === 0) {
    return (
      <EmptyState
        message={side === "owner" ? EMPTY_DAY_OWNER : EMPTY_DAY_STAFF}
      />
    );
  }
  const names = new Map(
    agenda.columns.map((column) => [column.id, column.name]),
  );
  return (
    <ul className="mx-auto flex w-full max-w-[720px] flex-col gap-2 px-4 pb-24 pt-2 md:px-6">
      {agenda.bookings.map((booking) => {
        const fromClient = booking.bookedBy === "client";
        return (
          <li key={booking.id}>
            <InstantLink
              href={`/pro/agenda?dia=${agenda.day}&vista=lista&cita=${booking.id}`}
              group={NAV_GROUP.agendaBooking}
              selectable={false}
              push
              className={cn(
                "flex items-center gap-3 rounded-booking border-l-4 border-primary-400 px-3 py-2.5 text-ink transition-shadow duration-120 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                fromClient ? "bg-primary-100" : "bg-primary-200",
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-12">
                  {formatTime(booking.startsAt)} - {formatTime(booking.endsAt)}
                </span>
                <span className="truncate text-16 font-bold">
                  {booking.clientName}
                </span>
                <span className="truncate text-14">
                  {booking.serviceName}
                  {side === "owner" && names.has(booking.staffId)
                    ? ` · ${names.get(booking.staffId)}`
                    : ""}
                </span>
              </span>
              {fromClient && (
                <UserRound
                  className="size-5 shrink-0 text-primary"
                  aria-label="La reservó el cliente"
                />
              )}
            </InstantLink>
          </li>
        );
      })}
    </ul>
  );
}
