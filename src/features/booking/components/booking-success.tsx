"use client";

import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatClock } from "@/features/agenda/lib/hours";
import { formatLongDate } from "@/shared/lib/dates";

export interface BookedSummary {
  staffName: string;
  day: string;
  time: string;
}

// "¡Listo, quedó reservada!" (US-027, captura 120): el profesional, la fecha y la hora en grande y
// el consejo de llegar con tiempo. Cerrar (o la X) lleva a Mis Reservas.
export function BookingSuccess({ booked }: { booked: BookedSummary | null }) {
  const router = useRouter();
  const close = () => router.push("/app/reservas");
  // "sábado, 31 de octubre de 2026" → "El sábado, 31 de octubre".
  const date = booked
    ? formatLongDate(`${booked.day}T12:00:00-05:00`).replace(/ de \d{4}$/, "")
    : "";

  return (
    <Dialog open={booked !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="flex flex-col items-center gap-4 py-10 text-center">
        <CircleCheck className="size-16 text-success" aria-hidden />
        <DialogTitle className="text-22 font-bold text-primary">
          ¡Listo, quedó reservada!
        </DialogTitle>
        {booked && (
          <>
            <span
              aria-hidden
              className="flex size-24 items-center justify-center rounded-full bg-primary text-30 font-bold text-surface"
            >
              {booked.staffName.charAt(0).toUpperCase()}
            </span>
            <p className="text-18 text-ink">
              <strong>{booked.staffName}</strong>
              <br />
              Te está esperando
            </p>
            <DialogDescription className="text-18 text-ink">
              El {date} a las
              <br />
              <span className="text-30 font-bold text-primary">
                {formatClock(booked.time)}
              </span>
            </DialogDescription>
            <p className="text-16 text-slate">
              Recuerda llegar 5 minutos antes.
            </p>
          </>
        )}
        <Button type="button" onClick={close} className="w-full max-w-xs">
          Cerrar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
