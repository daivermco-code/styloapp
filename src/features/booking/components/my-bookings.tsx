"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DetailRows } from "@/shared/components/detail-rows";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import {
  addDays,
  formatLongDate,
  formatShortDate,
  formatTime,
  minutesBetween,
  todayInBogota,
} from "@/shared/lib/dates";
import { formatMinutes } from "@/shared/lib/duration";
import { formatCOP } from "@/shared/lib/money";
import type { MyBooking } from "../types/booking";
import { BookingChanges } from "./booking-changes";

export const NO_BOOKINGS = "No tienes reservas aquí.";

// El estado como lo dice el diseño: sin calificar hasta que el profesional marca la llegada.
const STATUS_LABEL: Record<MyBooking["status"], string> = {
  pending: "Sin calificar",
  successful: "Efectiva",
  unsuccessful: "Abandonada",
  cancelled: "Cancelada",
};

const STATUS_CLASS: Record<MyBooking["status"], string> = {
  pending: "bg-soft text-slate",
  successful: "bg-success/10 text-success",
  unsuccessful: "bg-danger/10 text-danger",
  cancelled: "bg-soft text-slate",
};

const TAB_CLASS =
  "min-h-11 flex-1 rounded-none border-b-4 border-stroke text-16 font-bold text-slate data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none";

/** "Hoy - 11:00 a. m.", "Mañana - 9:00 a. m." o "lun 2 nov - 9:00 a. m.". */
function whenLabel(startsAt: string, today: string): string {
  const day = todayInBogota(startsAt);
  const date =
    day === today
      ? "Hoy"
      : day === addDays(today, 1)
        ? "Mañana"
        : formatShortDate(startsAt);
  return `${date} - ${formatTime(startsAt)}`;
}

function BookingDetail({ booking }: { booking: MyBooking }) {
  return (
    <DetailRows
      className="px-4"
      rows={[
        { label: "Servicio", value: booking.serviceName },
        { label: "Valor", value: formatCOP(booking.price) },
        { label: "Promoción", value: "Sin promoción en esta fecha" },
        {
          label: "Duración",
          value: formatMinutes(
            minutesBetween(booking.startsAt, booking.endsAt),
          ),
        },
        {
          label: "Fecha",
          value: (
            <span className="first-letter:uppercase">
              {formatLongDate(booking.startsAt)}
            </span>
          ),
        },
        { label: "Hora", value: formatTime(booking.startsAt) },
        { label: "Profesional", value: booking.staffName },
        { label: "Lugar", value: booking.business.name },
        {
          label: "Dirección",
          value: [booking.business.address, booking.business.neighborhood]
            .filter(Boolean)
            .join(" · "),
        },
      ]}
    />
  );
}

interface BookingRowProps {
  booking: MyBooking;
  today: string;
  /** La hora de la página, para saber si todavía se puede cambiar. */
  now: string;
  history: boolean;
  /** La cita que llega desplegada (`?cita=<id>`, desde la bandeja). */
  openId: string | null;
}

function BookingRow({ booking, today, now, history, openId }: BookingRowProps) {
  const hydrated = useHydrated();
  const reveal = booking.id === openId;
  const [open, setOpen] = useState(reveal);
  const rowRef = useRef<HTMLLIElement>(null);
  const rate = history && booking.status === "successful" && !booking.reviewed;
  // La cita que llega desplegada se trae a la vista: puede estar al fondo del Historial.
  useEffect(() => {
    if (reveal) rowRef.current?.scrollIntoView({ block: "center" });
  }, [reveal]);
  return (
    <li ref={rowRef} className="border-b border-line">
      <button
        type="button"
        aria-expanded={open}
        disabled={!hydrated}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default"
      >
        <ChevronDown
          aria-hidden
          className={cn(
            "size-5 shrink-0 text-primary transition-transform duration-120",
            open && "rotate-180",
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-16 text-ink">
            {booking.serviceName}
          </span>
          <span className="truncate text-14 text-slate">
            {booking.business.name}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-14 text-ink">
            {whenLabel(booking.startsAt, today)}
          </span>
          {history && (
            <span
              className={cn(
                "rounded-full px-2 text-12 font-bold",
                STATUS_CLASS[booking.status],
              )}
            >
              {STATUS_LABEL[booking.status]}
            </span>
          )}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 pb-4">
          <BookingDetail booking={booking} />
          {!history && (
            <BookingChanges booking={booking} today={today} now={now} />
          )}
          {rate && (
            <Button asChild className="mx-4 self-end">
              <Link href={`/app/calificar/${booking.id}`}>
                Califica tu experiencia
              </Link>
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function BookingList({
  bookings,
  today,
  now,
  history,
  openId,
}: Omit<BookingRowProps, "booking"> & { bookings: MyBooking[] }) {
  if (bookings.length === 0) {
    return (
      <p role="status" className="px-4 py-16 text-center text-14 text-slate">
        {NO_BOOKINGS}
      </p>
    );
  }
  return (
    <ul>
      {bookings.map((booking) => (
        <BookingRow
          key={booking.id}
          booking={booking}
          today={today}
          now={now}
          history={history}
          openId={openId}
        />
      ))}
    </ul>
  );
}

interface MyBookingsProps {
  /** Las que vienen (sin calificar y sin terminar), de la más cercana a la más lejana. */
  current: MyBooking[];
  /** Las pasadas y las canceladas, de la más nueva a la más vieja. */
  history: MyBooking[];
  today: string;
  now: string;
  initialTab: "actuales" | "historial";
  /** La cita que llega desplegada (`?cita=<id>`, desde la bandeja). */
  openId: string | null;
}

// Mis Reservas (US-028, capturas 113, 121, 122 y 196): pestañas Actuales e Historial; cada cita
// se despliega con los datos de la confirmación; las actuales traen Modificar y Cancelar (US-029).
export function MyBookings({
  current,
  history,
  today,
  now,
  initialTab,
  openId,
}: MyBookingsProps) {
  return (
    <Tabs defaultValue={initialTab} className="flex flex-col">
      <TabsList className="grid h-auto grid-cols-2 gap-2 rounded-none bg-transparent p-0 px-4">
        <TabsTrigger value="actuales" className={TAB_CLASS}>
          Actuales
        </TabsTrigger>
        <TabsTrigger value="historial" className={TAB_CLASS}>
          Historial
        </TabsTrigger>
      </TabsList>
      <TabsContent value="actuales" className="mt-0">
        <BookingList
          bookings={current}
          today={today}
          now={now}
          history={false}
          openId={openId}
        />
      </TabsContent>
      <TabsContent value="historial" className="mt-0">
        <BookingList
          bookings={history}
          today={today}
          now={now}
          history
          openId={openId}
        />
      </TabsContent>
    </Tabs>
  );
}
