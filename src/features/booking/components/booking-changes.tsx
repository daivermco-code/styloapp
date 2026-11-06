"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { minuteOfDay } from "@/features/agenda/lib/grid";
import { fromMinutes } from "@/features/agenda/lib/hours";
import { canClientCancel } from "@/features/agenda/lib/rules";
import type { BookingServiceOption } from "@/features/agenda/types/agenda";
import { cn } from "@/lib/utils";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { minutesBetween, todayInBogota } from "@/shared/lib/dates";
import { formatCOP } from "@/shared/lib/money";
import {
  type ActionResult,
  actionOk,
  AppErrorCode,
} from "@/shared/types/action-result";
import {
  cancelAsClient,
  loadRescheduleHours,
  rescheduleAsClient,
} from "../services/actions";
import type { MyBooking } from "../types/booking";
import { CLIENT_NO_HOURS, CLIENT_TOO_LATE } from "../types/schemas";
import { BookingSheet, type SheetChoice } from "./booking-sheet";

export const CANCEL_QUESTION = "¿Seguro que quieres cancelar esta cita?";
export const CANCEL_LATE_WARNING =
  "Cancelar tan cerca de la hora puede afectar tu reputación.";

// Cancelar a menos de una hora avisa de la reputación (US-029); en el MVP no la cambia.
const LATE_CANCEL_MINUTES = 60;

/** La cita como servicio de la hoja: solo su profesional, con la duración y el precio que tiene. */
function serviceOf(booking: MyBooking): BookingServiceOption {
  const minutes = minutesBetween(booking.startsAt, booking.endsAt);
  return {
    id: booking.serviceId,
    name: booking.serviceName,
    priceLabel: formatCOP(booking.price),
    durationMinutes: minutes,
    staff: [
      {
        id: booking.staffId,
        name: booking.staffName,
        durationMinutes: minutes,
        price: booking.price,
      },
    ],
  };
}

interface RescheduleSheetProps {
  booking: MyBooking;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Modificar cita: la hoja de reservar con la cita cargada y su hora libre. Se cambian el día y la
// hora; el servicio y el profesional quedan los mismos (`client_reschedule`). La X de la hoja de
// reservar la cierra, por eso se esconde la de la ventana.
function RescheduleSheet({
  booking,
  today,
  open,
  onOpenChange,
}: RescheduleSheetProps) {
  const router = useRouter();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const day = todayInBogota(booking.startsAt);

  const submit = async (choice: SheetChoice): Promise<ActionResult<null>> => {
    const result = await rescheduleAsClient({
      bookingId: booking.id,
      day: choice.day,
      time: choice.time,
    });
    if (result.ok) {
      toast.success("Listo, tu cita cambió");
      onOpenChange(false);
      router.refresh();
      return result;
    }
    // Pasado el límite la hoja ya no sirve: se cierra con el aviso.
    if (result.error.code === AppErrorCode.CANCEL_TOO_LATE) {
      toast.error(result.error.message);
      onOpenChange(false);
      router.refresh();
      return actionOk(null);
    }
    return result;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        className={cn(
          "overflow-y-auto p-0 [&>button]:hidden",
          desktop
            ? "w-[400px] sm:max-w-[400px]"
            : "max-h-[85dvh] rounded-t-sheet",
        )}
      >
        <SheetTitle className="sr-only">Modificar cita</SheetTitle>
        <SheetDescription className="sr-only">
          Elige otro día u otra hora para tu cita.
        </SheetDescription>
        <BookingSheet
          service={serviceOf(booking)}
          today={today}
          initial={{
            staffId: booking.staffId,
            day,
            time: fromMinutes(minuteOfDay(booking.startsAt, day)),
            durationMinutes: null,
            guestName: null,
          }}
          askGuestName={false}
          submitLabel="Modificar cita"
          loadHours={({ day: wanted }) =>
            loadRescheduleHours({ bookingId: booking.id, day: wanted })
          }
          onSubmit={submit}
          onRemoveService={() => onOpenChange(false)}
          forClient
          noHoursMessage={CLIENT_NO_HOURS}
          closeLabel="Cerrar"
        />
      </SheetContent>
    </Sheet>
  );
}

interface CancelDialogProps {
  booking: MyBooking;
  /** Abierta con el aviso de cancelar tarde (true), sin él (false) o cerrada (null). */
  late: boolean | null;
  onClose: () => void;
}

function CancelDialog({ booking, late, onClose }: CancelDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useActionTransition();
  const cancel = () => {
    startTransition(async () => {
      const result = await cancelAsClient({ bookingId: booking.id });
      if (result.ok) toast.success("Cita cancelada");
      else toast.error(result.error.message);
      onClose();
      router.refresh();
    });
  };
  return (
    <AlertDialog
      open={late !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <AlertDialogContent className="w-[calc(100%-32px)] rounded-card">
        <AlertDialogHeader>
          <AlertDialogTitle>{CANCEL_QUESTION}</AlertDialogTitle>
          <AlertDialogDescription className="text-14 text-ink">
            {booking.serviceName} en {booking.business.name}.
            {late && (
              <>
                <br />
                <strong className="text-danger">{CANCEL_LATE_WARNING}</strong>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={pending}>No, volver</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={cancel}
          >
            {pending && <LoaderCircle className="animate-spin" />}
            Sí, cancelar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface BookingChangesProps {
  booking: MyBooking;
  today: string;
  /** La hora de la página: decide si todavía se puede cambiar. */
  now: string;
}

// Modificar cita y Cancelar cita en una cita actual de Mis Reservas (US-029). Pasado el límite de
// cancelación del negocio no salen los botones y dice que le escriba al negocio; la base lo
// vuelve a revisar al guardar.
export function BookingChanges({ booking, today, now }: BookingChangesProps) {
  const hydrated = useHydrated();
  const [editing, setEditing] = useState(false);
  const [late, setLate] = useState<boolean | null>(null);

  if (
    !canClientCancel(booking.startsAt, booking.business.cancelLimitMinutes, now)
  ) {
    return (
      <p role="note" className="mx-4 text-14 text-slate">
        {CLIENT_TOO_LATE}
      </p>
    );
  }

  const askCancel = () =>
    setLate(minutesBetween(new Date(), booking.startsAt) < LATE_CANCEL_MINUTES);

  return (
    <div className="flex flex-wrap justify-end gap-2 px-4">
      <Button
        type="button"
        variant="outline"
        disabled={!hydrated}
        onClick={askCancel}
      >
        Cancelar cita
      </Button>
      <Button
        type="button"
        disabled={!hydrated}
        onClick={() => setEditing(true)}
      >
        Modificar cita
      </Button>
      <RescheduleSheet
        booking={booking}
        today={today}
        open={editing}
        onOpenChange={setEditing}
      />
      <CancelDialog
        booking={booking}
        late={late}
        onClose={() => setLate(null)}
      />
    </div>
  );
}
