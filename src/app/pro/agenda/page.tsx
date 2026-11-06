import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  NewBookingFab,
  RefreshAgendaButton,
} from "@/features/agenda/components/agenda-actions";
import { AgendaGrid } from "@/features/agenda/components/agenda-grid";
import { AgendaRealtime } from "@/features/agenda/components/agenda-realtime";
import { AgendaList } from "@/features/agenda/components/agenda-list";
import { AgendaSkeleton } from "@/features/agenda/components/agenda-skeleton";
import { AgendaToolbar } from "@/features/agenda/components/agenda-toolbar";
import {
  BookingDetail,
  BookingDetailSkeleton,
} from "@/features/agenda/components/booking-detail";
import { parseDay } from "@/features/agenda/lib/grid";
import {
  getAgendaDay,
  getAgendaViewer,
  getBookingDetail,
} from "@/features/agenda/services/queries";
import type { AgendaViewer } from "@/features/agenda/types/agenda";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { PendingArea } from "@/shared/components/instant-nav";
import { TopBar } from "@/shared/components/top-bar";
import { todayInBogota } from "@/shared/lib/dates";
import { NAV_GROUP } from "@/shared/lib/instant-nav";

export const metadata: Metadata = { title: "Agenda" };

async function AgendaDayView({
  viewer,
  day,
  list,
}: {
  viewer: AgendaViewer;
  day: string;
  list: boolean;
}) {
  const agenda = await getAgendaDay(viewer, day);
  return list ? (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <AgendaList agenda={agenda} side={viewer.side} />
    </div>
  ) : (
    <AgendaGrid
      agenda={agenda}
      canBook={viewer.canBook}
      canBlock={viewer.canBlock}
    />
  );
}

// Agenda del negocio y del profesional (T-3.3.2, US-015 y US-016), con el detalle de una cita en
// una ventana (?cita=<id>, US-018). La página ocupa la pantalla: la barra y los días quedan arriba
// y la grilla se desplaza en su caja. El día y la vista van en la URL; al cambiarlos, la grilla
// sale en esqueleto desde el toque (PendingArea, Fase 17) hasta que llega el día nuevo.
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; vista?: string; cita?: string }>;
}) {
  const person = await getCurrentPerson();
  if (!person) redirect("/entrar?siguiente=/pro/agenda");
  const viewer = await getAgendaViewer(person);
  // El proxy solo deja entrar a /pro a quien tiene una fila activa en staff (invariante 1).
  if (!viewer) redirect("/pro");

  const { dia, vista, cita } = await searchParams;
  const today = todayInBogota();
  // Desde la bandeja llega solo ?cita=: la agenda abre en el día de esa cita.
  const detail = cita ? await getBookingDetail(viewer, cita) : null;
  const day = parseDay(dia) ?? detail?.day ?? today;
  const list = vista === "lista";
  const ownColumn = viewer.side === "staff" ? viewer.staffId : null;

  return (
    <div className="flex h-dvh flex-col bg-surface">
      <TopBar
        title="Agenda"
        icon={<CalendarDays />}
        backHref="/pro"
        actions={<RefreshAgendaButton />}
      />
      <AgendaToolbar day={day} today={today} list={list} />
      <PendingArea
        groups={[NAV_GROUP.agenda]}
        fallback={<AgendaSkeleton list={false} />}
        byParam={{
          param: "vista",
          fallbacks: { lista: <AgendaSkeleton list /> },
        }}
      >
        <Suspense
          key={`${day}-${list}`}
          fallback={<AgendaSkeleton list={list} />}
        >
          <AgendaDayView viewer={viewer} day={day} list={list} />
        </Suspense>
      </PendingArea>
      <NewBookingFab day={day} staffId={ownColumn} canBook={viewer.canBook} />
      <PendingArea
        groups={[NAV_GROUP.agendaBooking]}
        fallback={<BookingDetailSkeleton />}
      >
        {detail && (
          <BookingDetail
            key={detail.id}
            detail={detail}
            closeHref={`/pro/agenda?dia=${day}${list ? "&vista=lista" : ""}`}
          />
        )}
      </PendingArea>
      <AgendaRealtime
        businessId={viewer.businessId}
        staffId={ownColumn}
        phone={person.phone}
      />
    </div>
  );
}
