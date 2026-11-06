import type { Metadata } from "next";
import { PersonGreeting } from "@/features/auth/components/person-greeting";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { MyBookingsRealtime } from "@/features/booking/components/my-bookings-realtime";
import {
  RecentServices,
  recentServices,
} from "@/features/booking/components/recent-services";
import { getMyBookings } from "@/features/booking/services/queries";
import { BusinessList } from "@/features/explore/components/business-list";
import { listBusinesses } from "@/features/explore/services/queries";
import { RatingHome } from "@/features/reviews/components/rating-home";
import { ClientTopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Inicio" };

// Inicio de clientes (US-024, captura 90): el buscador y "Cerca de ti" del punto de la demo, sin
// pedir sesión. Con sesión, el saludo y "Tus servicios recientes"; si tiene una cita efectiva
// sin calificar, el Inicio cambia por calificarla (US-030, captura 193). Las citas llegan por
// tiempo real: cuando el profesional marca la llegada, la invitación sale sin recargar.
export default async function ClientHomePage() {
  const [person, businesses] = await Promise.all([
    getCurrentPerson(),
    listBusinesses(),
  ]);
  const bookings = person ? await getMyBookings() : [];
  const toRate =
    bookings.find(
      (booking) => booking.status === "successful" && !booking.reviewed,
    ) ?? null;

  const nearby = (
    <BusinessList
      businesses={businesses}
      signedIn={person !== null}
      variant="nearby"
      searchPlaceholder="Busca un negocio"
    />
  );

  return (
    <>
      <ClientTopBar title="Inicio" />
      <main className="flex flex-col gap-6 p-4 md:p-6">
        {person ? (
          <>
            <MyBookingsRealtime />
            <RatingHome
              toRate={toRate}
              fullName={person.fullName ?? "Persona de la demo"}
            >
              <PersonGreeting person={person} />
              <RecentServices bookings={recentServices(bookings)} />
              {nearby}
            </RatingHome>
          </>
        ) : (
          nearby
        )}
      </main>
    </>
  );
}
