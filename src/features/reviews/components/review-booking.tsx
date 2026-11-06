"use client";

import { useRouter } from "next/navigation";
import type { MyBooking } from "@/features/booking/types/booking";
import { ReviewForm } from "./review-form";

// Calificar desde Historial (US-030): al enviar va al Inicio, que ya muestra "Tus servicios
// recientes"; "Calificar más tarde" vuelve a Historial.
export function ReviewBooking({ booking }: { booking: MyBooking }) {
  const router = useRouter();
  return (
    <ReviewForm
      booking={booking}
      onLater={() => router.push("/app/reservas?pestana=historial")}
      onSent={() => router.push("/app")}
    />
  );
}
