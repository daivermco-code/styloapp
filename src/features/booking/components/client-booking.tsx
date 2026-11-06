"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { BookingServiceOption } from "@/features/agenda/types/agenda";
import { signInHref } from "@/features/explore/components/login-prompt";
import { formatCOP } from "@/shared/lib/money";
import {
  type ActionResult,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import { bookAsClient, loadClientHours } from "../services/actions";
import { CLIENT_NO_HOURS } from "../types/schemas";
import { BookingReview, type ReviewSummary } from "./booking-review";
import { BookingSheet, type SheetChoice } from "./booking-sheet";
import { type BookedSummary, BookingSuccess } from "./booking-success";

/** El negocio donde se reserva, para la verificación. */
export interface BookingPlace {
  id: string;
  name: string;
  address: string;
  neighborhood: string | null;
}

interface ClientBookingProps {
  place: BookingPlace;
  service: BookingServiceOption;
  today: string;
  /** Lo elegido que trae la URL (vuelve de entrar con todo puesto). */
  initial: { staffId: string | null; day: string; time: string | null };
  signedIn: boolean;
  onClose: () => void;
  /** A dónde vuelve después de entrar, con lo elegido; por defecto, la página del negocio. */
  returnPath?: (choice: SheetChoice) => string;
  /** Cambios de la página por enlace: "Agendar cita", "Cambiar" y su texto de falta la hora. */
  submitLabel?: string;
  closeText?: string;
  missingMessage?: string;
  className?: string;
}

interface PendingReview {
  choice: SheetChoice;
  summary: ReviewSummary;
}

/** La página del negocio con todo lo elegido, para volver después de entrar (T-5.3.2). */
export function bookingPath(
  businessId: string,
  serviceId: string,
  choice: SheetChoice,
): string {
  const params = new URLSearchParams({
    servicio: serviceId,
    profesional: choice.staffId,
    dia: choice.day,
    hora: choice.time,
  });
  return `/app/negocio/${businessId}?${params.toString()}`;
}

// Reservar como cliente (US-027): la hoja de la Fase 3 sin el paso de cliente ni la duración.
// Reservar abre "Revisa tu reserva" (sin esperarla: lo que cambia el estado dentro de la
// transición de la hoja no se pinta hasta que termina); si al confirmar la hora ya no se puede,
// avisa y la hoja vuelve a pedir las horas con `staleKey`. Sin sesión, Reservar lleva a entrar.
export function ClientBooking({
  place,
  service,
  today,
  initial,
  signedIn,
  onClose,
  returnPath = (choice) => bookingPath(place.id, service.id, choice),
  submitLabel = "Reservar",
  closeText,
  missingMessage,
  className,
}: ClientBookingProps) {
  const router = useRouter();
  const [review, setReview] = useState<PendingReview | null>(null);
  const [booked, setBooked] = useState<BookedSummary | null>(null);
  const [stale, setStale] = useState(0);

  const summaryOf = (choice: SheetChoice): ReviewSummary => {
    const staff = service.staff.find((option) => option.id === choice.staffId);
    return {
      serviceName: service.name,
      priceLabel: staff ? formatCOP(staff.price) : service.priceLabel,
      durationMinutes: choice.durationMinutes,
      day: choice.day,
      time: choice.time,
      staffName: staff?.name ?? "",
      businessName: place.name,
      address: [place.address, place.neighborhood].filter(Boolean).join(" · "),
    };
  };

  const submit = (choice: SheetChoice): Promise<ActionResult<unknown>> => {
    if (signedIn) setReview({ choice, summary: summaryOf(choice) });
    else router.push(signInHref(returnPath(choice)));
    return Promise.resolve(actionOk(null));
  };

  const confirm = async (whatsappPromos: boolean) => {
    if (!review) return;
    const { choice, summary } = review;
    const result = await bookAsClient({
      serviceId: service.id,
      staffId: choice.staffId,
      day: choice.day,
      time: choice.time,
      whatsappPromos,
    });
    setReview(null);
    if (result.ok) {
      setBooked({
        staffName: summary.staffName,
        day: choice.day,
        time: choice.time,
      });
      return;
    }
    toast.error(result.error.message);
    if (
      result.error.code === AppErrorCode.SLOT_TAKEN ||
      result.error.code === AppErrorCode.OUTSIDE_HOURS
    ) {
      setStale((value) => value + 1);
    }
  };

  return (
    <>
      <BookingSheet
        service={service}
        today={today}
        initial={{ ...initial, durationMinutes: null, guestName: null }}
        askGuestName={false}
        submitLabel={submitLabel}
        loadHours={({ staffId, day }) =>
          loadClientHours({
            businessId: place.id,
            serviceId: service.id,
            staffId,
            day,
          })
        }
        onSubmit={submit}
        onRemoveService={onClose}
        staleKey={stale}
        forClient
        noHoursMessage={CLIENT_NO_HOURS}
        closeText={closeText}
        missingMessage={missingMessage}
        className={className}
      />
      <BookingReview
        summary={review?.summary ?? null}
        onConfirm={confirm}
        onCancel={() => setReview(null)}
      />
      <BookingSuccess booked={booked} />
    </>
  );
}
