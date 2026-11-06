"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/shared/components/empty-state";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import {
  deleteSeriesWarning,
  seriesLeft,
  seriesRhythm,
} from "../lib/recurring";
import { deleteSeries } from "../services/recurring-actions";
import type { RecurringSeries } from "../services/recurring-queries";

export const NO_SERIES = "No hay agendas recurrentes.";

function cancelledText(cancelled: number): string {
  if (cancelled === 0) return "Eliminaste la serie.";
  return cancelled === 1
    ? "Eliminaste la serie y se canceló 1 cita."
    : `Eliminaste la serie y se cancelaron ${cancelled} citas.`;
}

/** "Eliminar serie" con su confirmación: cancela las que faltan y avisa al cliente. */
function DeleteSeriesButton({ series }: { series: RecurringSeries }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useActionTransition();
  const confirm = () => {
    startTransition(async () => {
      const result = await deleteSeries({ recurringId: series.id });
      if (!result.ok) {
        toast.error(result.error.message);
        if (result.error.code === "NOT_FOUND") setOpen(false);
        router.refresh();
        return;
      }
      setOpen(false);
      toast.success(cancelledText(result.data.cancelled));
      router.refresh();
    });
  };
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!hydrated}
          aria-label={`Eliminar la serie de ${series.clientName}`}
          className="-ml-3 self-start text-danger hover:text-danger"
        >
          <Trash2 aria-hidden />
          Eliminar serie
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-32px)] rounded-card">
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Eliminar la serie de {series.clientName}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-14 text-ink">
            {deleteSeriesWarning(series.left)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={pending} className="mt-0">
            No, dejarla
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            onClick={confirm}
            disabled={pending}
          >
            {pending && <LoaderCircle className="animate-spin" />}
            Sí, eliminar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Agendas recurrentes (T-10.2.2, US-050, pantalla 17, captura 72): una tarjeta por serie con el
// cliente, el servicio con su profesional, la frecuencia con el día y la hora, cuántas citas le
// quedan y "Eliminar serie".
export function RecurringList({ series }: { series: RecurringSeries[] }) {
  if (series.length === 0) return <EmptyState message={NO_SERIES} />;
  return (
    <ul aria-label="Series" className="flex flex-col gap-3">
      {series.map((item) => (
        <li
          key={item.id}
          aria-label={item.clientName}
          className="flex flex-col gap-1 rounded-card border border-line bg-surface px-4 pb-1 pt-3"
        >
          <span className="text-16 font-bold text-ink">{item.clientName}</span>
          <span className="text-14 text-ink">
            {item.serviceName} con {item.staffName}
          </span>
          <span className="text-14 text-slate">{seriesRhythm(item)}</span>
          <span className="text-14 font-bold text-primary">
            {seriesLeft(item.left)}
          </span>
          <DeleteSeriesButton series={item} />
        </li>
      ))}
    </ul>
  );
}
