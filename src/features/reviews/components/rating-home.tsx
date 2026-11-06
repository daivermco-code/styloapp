"use client";

import { type ReactNode, useState } from "react";
import type { MyBooking } from "@/features/booking/types/booking";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { isRatingLater, ReviewForm } from "./review-form";

interface RatingHomeProps {
  /** La última cita efectiva sin calificar, o null. */
  toRate: MyBooking | null;
  fullName: string;
  /** El Inicio de siempre. */
  children: ReactNode;
}

// Con una cita por calificar, el Inicio cambia por el saludo de regreso y el formulario (US-030,
// captura 193). "Calificar más tarde" (recordado en la pestaña) y Enviar vuelven al Inicio de
// siempre; al enviar, el servidor ya trae la siguiente por calificar o "Tus servicios recientes".
export function RatingHome({ toRate, fullName, children }: RatingHomeProps) {
  const hydrated = useHydrated();
  const [closed, setClosed] = useState<string | null>(null);
  const rating =
    toRate && toRate.id !== closed && !(hydrated && isRatingLater(toRate.id))
      ? toRate
      : null;

  if (!rating) return children;
  return (
    <section
      aria-labelledby="hola-de-nuevo"
      className="mx-auto flex w-full max-w-lg flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <h2
          id="hola-de-nuevo"
          className="text-22 font-bold leading-tight text-primary"
        >
          ¡Hola de nuevo, {fullName}!
        </h2>
        <p className="text-18 font-bold text-secondary">
          Cuéntanos cómo te fue en tu última cita.
        </p>
      </div>
      <ReviewForm
        key={rating.id}
        booking={rating}
        onLater={() => setClosed(rating.id)}
        onSent={() => setClosed(rating.id)}
      />
    </section>
  );
}
