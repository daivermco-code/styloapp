"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BookingSummaryCard } from "@/features/booking/components/booking-summary-card";
import type { MyBooking } from "@/features/booking/types/booking";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { submitReview } from "../services/actions";
import {
  ATTENTION_LABEL,
  COMMENT_MAX,
  QUALITY_LABEL,
  STARS_MISSING,
} from "../types/schemas";
import { StarInput } from "./star-input";

// "Calificar más tarde" se recuerda en la pestaña (T-5.5.1): al volver al Inicio no vuelve a
// salir esa cita hasta cerrar la pestaña. Sigue en Historial con "Califica tu experiencia".
const LATER_KEY = "styloapp:calificar-despues";

function laterIds(): string[] {
  try {
    const saved: unknown = JSON.parse(
      window.sessionStorage.getItem(LATER_KEY) ?? "[]",
    );
    return Array.isArray(saved)
      ? saved.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function isRatingLater(bookingId: string): boolean {
  return laterIds().includes(bookingId);
}

export function rememberRatingLater(bookingId: string): void {
  try {
    window.sessionStorage.setItem(
      LATER_KEY,
      JSON.stringify([...laterIds(), bookingId]),
    );
  } catch {
    // Sin almacenamiento (ventana privada): solo vuelve al Inicio.
  }
}

interface ReviewFormProps {
  booking: MyBooking;
  onLater: () => void;
  onSent: () => void;
}

// Calificar la cita (US-030, capturas 193 y 200): la tarjeta, dos filas de cinco estrellas, un
// comentario opcional de 500, Enviar apagado hasta poner las dos y "Calificar más tarde".
export function ReviewForm({ booking, onLater, onSent }: ReviewFormProps) {
  const hydrated = useHydrated();
  const [attention, setAttention] = useState(0);
  const [quality, setQuality] = useState(0);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useActionTransition();
  const missing = attention === 0 || quality === 0;

  const send = () =>
    startTransition(async () => {
      const result = await submitReview({
        bookingId: booking.id,
        attention,
        quality,
        comment,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("¡Gracias por contarnos cómo te fue!");
      onSent();
    });

  return (
    <div className="flex flex-col gap-6">
      <BookingSummaryCard booking={booking} />
      <StarInput
        label={ATTENTION_LABEL}
        value={attention}
        onChange={setAttention}
        disabled={!hydrated || pending}
      />
      <StarInput
        label={QUALITY_LABEL}
        value={quality}
        onChange={setQuality}
        disabled={!hydrated || pending}
      />
      <div className="flex flex-col gap-2">
        <label htmlFor="review-comment" className="text-14 text-ink">
          Escribe tus comentarios (opcional)
        </label>
        <textarea
          id="review-comment"
          rows={3}
          maxLength={COMMENT_MAX}
          value={comment}
          disabled={!hydrated || pending}
          onChange={(event) => setComment(event.target.value)}
          className="w-full resize-none rounded-card border border-input bg-surface px-4 py-3 text-16 text-ink placeholder:text-slate focus-visible:border-2 focus-visible:border-primary focus-visible:px-[15px] focus-visible:py-[11px] focus-visible:outline-none disabled:opacity-50"
        />
        <p className="self-end text-12 text-slate">
          {comment.length}/{COMMENT_MAX}
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        {missing && (
          <p className="text-14 text-slate" aria-live="polite">
            {STARS_MISSING}
          </p>
        )}
        <Button
          type="button"
          onClick={send}
          disabled={!hydrated || missing || pending}
          className="w-full max-w-xs"
        >
          {pending && <LoaderCircle className="animate-spin" />}
          Enviar
        </Button>
        <Button
          type="button"
          variant="link"
          disabled={!hydrated || pending}
          onClick={() => {
            rememberRatingLater(booking.id);
            onLater();
          }}
          className="min-h-11"
        >
          Calificar más tarde
        </Button>
      </div>
    </div>
  );
}
