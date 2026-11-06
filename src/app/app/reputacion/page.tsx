import type { Metadata } from "next";
import { MyBookingsRealtime } from "@/features/booking/components/my-bookings-realtime";
import { getMyBookings } from "@/features/booking/services/queries";
import { ReputationView } from "@/features/reviews/components/reputation-view";
import { getMyReputation } from "@/features/reviews/services/queries";
import { ClientTopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Mi reputación" };

// Mi reputación (US-031). Sin sesión, el proxy la reescribe a "Mejora tu experiencia". Cambia sin
// recargar cuando el profesional marca la llegada (tiempo real de sus citas).
export default async function ReputationPage() {
  const [score, bookings] = await Promise.all([
    getMyReputation(),
    getMyBookings(),
  ]);
  return (
    <>
      <ClientTopBar title="Mi reputación" />
      <MyBookingsRealtime />
      <main className="mx-auto flex w-full max-w-lg flex-col p-4 md:p-6">
        <ReputationView
          score={score}
          marked={bookings.filter((booking) => booking.punctuality !== null)}
        />
      </main>
    </>
  );
}
