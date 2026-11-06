"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatClock } from "@/features/agenda/lib/hours";
import { DetailRows } from "@/shared/components/detail-rows";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { formatLongDate } from "@/shared/lib/dates";
import { formatMinutes } from "@/shared/lib/duration";

export interface ReviewSummary {
  serviceName: string;
  priceLabel: string;
  durationMinutes: number;
  day: string;
  time: string;
  staffName: string;
  businessName: string;
  address: string;
}

interface BookingReviewProps {
  summary: ReviewSummary | null;
  onConfirm: (whatsappPromos: boolean) => Promise<void>;
  onCancel: () => void;
}

// "Revisa tu reserva" (US-027, captura 119): los datos de la cita, la casilla de promociones por
// WhatsApp (sin marcar) y "Confirmar reserva".
export function BookingReview({
  summary,
  onConfirm,
  onCancel,
}: BookingReviewProps) {
  const [promos, setPromos] = useState(false);
  const [pending, startTransition] = useActionTransition();

  const confirm = () => startTransition(() => onConfirm(promos));

  return (
    <Dialog
      open={summary !== null}
      onOpenChange={(open) => !open && !pending && onCancel()}
    >
      <DialogContent className="max-h-[90dvh] gap-5 overflow-y-auto">
        <DialogTitle className="pr-8 text-center text-20 font-bold text-primary">
          Revisa tu reserva
        </DialogTitle>
        <DialogDescription className="sr-only">
          Los datos de la cita antes de confirmarla.
        </DialogDescription>
        {summary && (
          <DetailRows
            rows={[
              { label: "Servicio", value: summary.serviceName },
              { label: "Valor", value: summary.priceLabel },
              { label: "Promoción", value: "Sin promoción en esta fecha" },
              {
                label: "Duración",
                value: formatMinutes(summary.durationMinutes),
              },
              {
                label: "Fecha",
                value: (
                  <span className="first-letter:uppercase">
                    {formatLongDate(`${summary.day}T12:00:00-05:00`)}
                  </span>
                ),
              },
              { label: "Hora", value: formatClock(summary.time) },
              { label: "Profesional", value: summary.staffName },
              { label: "Lugar", value: summary.businessName },
              { label: "Dirección", value: summary.address },
            ]}
          />
        )}
        <label className="flex items-start gap-3 text-14 text-ink">
          <Checkbox
            checked={promos}
            onCheckedChange={(value) => setPromos(value === true)}
            className="mt-0.5"
          />
          Quiero recibir promociones, descuentos y novedades de este negocio por
          WhatsApp.
        </label>
        <Button type="button" onClick={confirm} disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" />}
          Confirmar reserva
        </Button>
      </DialogContent>
    </Dialog>
  );
}
