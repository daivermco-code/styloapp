import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { MyBookings } from "@/features/booking/components/my-bookings";
import { MyBookingsRealtime } from "@/features/booking/components/my-bookings-realtime";
import { getMyBookingTabs } from "@/features/booking/services/queries";
import { ClientTopBar } from "@/shared/components/top-bar";
import { todayInBogota } from "@/shared/lib/dates";

export const metadata: Metadata = { title: "Mis Reservas" };

interface MyBookingsPageProps {
  searchParams: Promise<{
    pestana?: string | string[];
    cita?: string | string[];
  }>;
}

// Mis Reservas (US-028). Sin sesión, el proxy la reescribe a "Mejora tu experiencia". Se
// actualiza sola si el negocio cambia, cancela o marca una cita. Con `?cita=<id>` (el aviso de la
// bandeja) abre la pestaña de esa cita con ella desplegada.
export default async function MyBookingsPage({
  searchParams,
}: MyBookingsPageProps) {
  const [{ pestana, cita }, { current, history }] = await Promise.all([
    searchParams,
    getMyBookingTabs(),
  ]);
  const openId = typeof cita === "string" ? cita : null;
  const inHistory = history.some((booking) => booking.id === openId);
  const inCurrent = current.some((booking) => booking.id === openId);
  const tab =
    inHistory || (!inCurrent && pestana === "historial")
      ? "historial"
      : "actuales";

  return (
    <>
      <ClientTopBar title="Mis citas" />
      <MyBookingsRealtime />
      <main className="flex flex-col gap-3 pb-6 pt-4">
        <h2 className="flex items-center justify-center gap-2 text-22 font-bold text-primary">
          <CalendarDays className="size-6" aria-hidden />
          Mis Reservas
        </h2>
        <MyBookings
          key={openId ?? tab}
          current={current}
          history={history}
          today={todayInBogota()}
          now={new Date().toISOString()}
          initialTab={tab}
          openId={openId}
        />
      </main>
    </>
  );
}
