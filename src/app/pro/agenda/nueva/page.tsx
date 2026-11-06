import { SquarePen } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AgendaGrid } from "@/features/agenda/components/agenda-grid";
import { BookingEditor } from "@/features/agenda/components/booking-editor";
import { parseDay } from "@/features/agenda/lib/grid";
import {
  getAgendaDay,
  getAgendaViewer,
  getBookingCatalog,
  getBusinessClients,
  getEditableBooking,
} from "@/features/agenda/services/queries";
import { NO_BOOKING_PERMISSION } from "@/features/agenda/types/messages";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { EmptyState } from "@/shared/components/empty-state";
import { TopBar } from "@/shared/components/top-bar";
import { formatLongDate, todayInBogota } from "@/shared/lib/dates";

export const metadata: Metadata = { title: "Editor de reservas" };

const CLOCK = /^\d{2}:\d{2}$/;

// Editor de reservas (T-3.4.1, US-017; con ?modificar=<id>, US-018). Desde la grilla llega con
// ?dia=, ?profesional= y ?hora=. En computador la agenda del día queda a la izquierda y el editor
// en el panel de la derecha.
export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{
    dia?: string;
    profesional?: string;
    hora?: string;
    modificar?: string;
  }>;
}) {
  const person = await getCurrentPerson();
  if (!person) redirect("/entrar?siguiente=/pro/agenda/nueva");
  const viewer = await getAgendaViewer(person);
  if (!viewer) redirect("/pro");

  const { dia, profesional, hora, modificar } = await searchParams;
  const today = todayInBogota();
  const editing = modificar ? await getEditableBooking(modificar) : null;
  const day = parseDay(dia) ?? editing?.day ?? today;
  const backHref = editing
    ? `/pro/agenda?dia=${editing.day}&cita=${editing.id}`
    : `/pro/agenda?dia=${day}`;
  const title = editing ? "Modificar cita" : "Editor de reservas";

  const blocked = !viewer.canBook
    ? NO_BOOKING_PERMISSION
    : modificar && !editing
      ? "Esta cita ya no existe o ya se canceló."
      : null;
  if (blocked) {
    return (
      <div className="min-h-dvh bg-surface">
        <TopBar title={title} icon={<SquarePen />} backHref={backHref} />
        <EmptyState message={blocked} />
      </div>
    );
  }

  const [categories, clients, agenda] = await Promise.all([
    getBookingCatalog(viewer),
    editing ? [] : getBusinessClients(viewer.businessId),
    getAgendaDay(viewer, day),
  ]);

  return (
    <div className="h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_440px]">
      <div className="hidden min-h-0 flex-col bg-surface lg:flex">
        <header className="flex min-h-14 items-center px-5 shadow-card">
          <h2 className="text-18 font-bold text-primary first-letter:uppercase">
            {formatLongDate(`${day}T12:00:00-05:00`)}
          </h2>
        </header>
        <AgendaGrid agenda={agenda} canBook={false} interactive={false} />
      </div>
      <div className="h-dvh overflow-y-auto bg-surface lg:border-l lg:border-line">
        <TopBar title={title} icon={<SquarePen />} backHref={backHref} />
        <BookingEditor
          today={today}
          categories={categories}
          clients={clients}
          canCreateClients={viewer.canCreateClients}
          canRepeat={viewer.side === "owner"}
          prefill={{
            day,
            staffId: profesional ?? null,
            time: hora && CLOCK.test(hora) ? hora : null,
          }}
          editing={editing}
        />
      </div>
    </div>
  );
}
