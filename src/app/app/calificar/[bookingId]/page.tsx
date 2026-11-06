import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getMyBookings } from "@/features/booking/services/queries";
import { ReviewBooking } from "@/features/reviews/components/review-booking";
import {
  ALREADY_REVIEWED,
  NOT_REVIEWABLE,
} from "@/features/reviews/types/schemas";
import { EmptyState } from "@/shared/components/empty-state";
import { ClientTopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Califica tu experiencia" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RateBookingPageProps {
  params: Promise<{ bookingId: string }>;
}

// Calificar una cita desde Historial (US-030). Sin sesión, el proxy la reescribe a "Mejora tu
// experiencia". Solo las citas propias (la RLS no deja ver otras): una ya calificada o que no
// se puede calificar lo dice en vez del formulario.
export default async function RateBookingPage({
  params,
}: RateBookingPageProps) {
  const { bookingId } = await params;
  const [booking] = UUID.test(bookingId) ? await getMyBookings(bookingId) : [];
  if (!booking) notFound();

  const message = booking.reviewed
    ? ALREADY_REVIEWED
    : booking.status !== "successful"
      ? NOT_REVIEWABLE
      : null;

  return (
    <>
      <ClientTopBar title="Calificar" />
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 p-4 md:p-6">
        <h2 className="text-22 font-bold text-primary">
          Califica tu experiencia
        </h2>
        {message ? (
          <EmptyState
            message={message}
            action={
              <Button asChild variant="outline">
                <Link href="/app/reservas?pestana=historial">
                  Volver a Mis Reservas
                </Link>
              </Button>
            }
          />
        ) : (
          <ReviewBooking booking={booking} />
        )}
      </main>
    </>
  );
}
