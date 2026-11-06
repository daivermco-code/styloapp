"use client";

import { ChevronDown, FileText, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookingInvoiceActions } from "@/features/invoices/components/booking-invoice-actions";
import { PunctualityPicker } from "@/features/reviews/components/punctuality-picker";
import { cn } from "@/lib/utils";
import { DetailRows } from "@/shared/components/detail-rows";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { formatLongDate, formatTime, minutesBetween } from "@/shared/lib/dates";
import { formatMinutes } from "@/shared/lib/duration";
import { formatCOP } from "@/shared/lib/money";
import { formatPhone } from "@/shared/lib/phone";
import { reputationText } from "../lib/rules";
import { cancelBooking, saveBookingNote } from "../services/actions";
import type { BookedBy, BookingDetail as Detail } from "../types/agenda";
import { BlockClientButton } from "./block-client-button";
import { Skeleton } from "@/components/ui/skeleton";

const BOOKED_BY: Record<BookedBy, string> = {
  owner: "Negocio",
  staff: "Profesional",
  client: "Cliente",
};

function CancelButton({
  bookingId,
  inSeries,
  onDone,
}: {
  bookingId: string;
  /** De una serie (US-022): pregunta si solo esta o también las siguientes. */
  inSeries: boolean;
  onDone: () => void;
}) {
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useActionTransition();
  const confirm = (scope: "one" | "following") => {
    startTransition(async () => {
      const result = await cancelBooking({ bookingId, scope });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setOpen(false);
      const { cancelled } = result.data;
      toast.success(
        cancelled === 1 ? "Cita cancelada" : `Se cancelaron ${cancelled} citas`,
      );
      onDone();
    });
  };
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={!hydrated}
          className="flex-1 border-danger text-danger hover:bg-danger/5"
        >
          Cancelar cita
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-32px)] rounded-card">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
          <AlertDialogDescription className="text-14 text-ink">
            {inSeries
              ? "Es parte de una serie. Le avisamos al cliente por cada cita."
              : "Le avisamos al cliente."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={pending} className="mt-0">
            No, dejarla
          </AlertDialogCancel>
          {inSeries ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => confirm("one")}
                disabled={pending}
                className="border-danger text-danger hover:bg-danger/5"
              >
                Solo esta
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => confirm("following")}
                disabled={pending}
              >
                {pending && <LoaderCircle className="animate-spin" />}
                Esta y las siguientes
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={() => confirm("one")}
              disabled={pending}
            >
              {pending && <LoaderCircle className="animate-spin" />}
              Sí, cancelar
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function NoteEditor({
  bookingId,
  note,
}: {
  bookingId: string;
  note: string | null;
}) {
  const hydrated = useHydrated();
  const [open, setOpen] = useState(Boolean(note));
  const [text, setText] = useState(note ?? "");
  const [pending, startTransition] = useActionTransition();
  const save = () => {
    startTransition(async () => {
      const result = await saveBookingNote({ bookingId, note: text });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Nota guardada");
    });
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        aria-expanded={open}
        disabled={!hydrated}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 items-center gap-2 text-16 text-primary disabled:cursor-default"
      >
        <FileText className="size-5" aria-hidden />
        {note ? "Nota" : "Crear nota"}
        <ChevronDown
          aria-hidden
          className={cn(
            "size-5 transition-transform duration-180",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="flex w-full flex-col gap-2">
          <textarea
            aria-label="Nota de la cita"
            value={text}
            maxLength={500}
            rows={3}
            onChange={(event) => setText(event.target.value)}
            className="w-full rounded-card border border-input bg-surface px-4 py-3 text-16 text-ink focus:border-2 focus:border-primary focus:px-[15px] focus:py-[11px] focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-12 text-slate">{text.length} de 500</span>
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={!hydrated || pending || text.trim() === (note ?? "")}
            >
              {pending && <LoaderCircle className="animate-spin" />}
              Guardar nota
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** La ventana de la cita mientras llega (Fase 17): se abre de una al tocar la cita. */
export function BookingDetailSkeleton() {
  return (
    <Dialog open>
      <DialogContent className="gap-5 px-5 pb-6 pt-10">
        <DialogTitle className="sr-only">Cargando la cita</DialogTitle>
        <DialogDescription className="sr-only">
          Llegan los datos de la cita.
        </DialogDescription>
        <div
          role="status"
          aria-label="Cargando la cita"
          className="flex flex-col gap-3"
        >
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-32" />
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-8" />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface BookingDetailProps {
  detail: Detail;
  /** A dónde vuelve al cerrar: la agenda sin `?cita=`. */
  closeHref: string;
}

// Detalle de la cita (T-3.5.1, US-018, captura 12): ventana sobre la agenda con la fecha larga,
// las filas, Modificar y Cancelar (o por qué no salen), la llegada desde que empezó y la nota.
export function BookingDetail({ detail, closeHref }: BookingDetailProps) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  // Se va en el acto, con su animación, aunque la agenda tarde en volver (Fase 17).
  const [open, setOpen] = useState(true);
  const close = () => {
    setOpen(false);
    router.replace(closeHref, { scroll: false });
  };
  const active = detail.status !== "cancelled";
  const rows = [
    { label: "Servicio", value: detail.serviceName },
    { label: "Reservado por", value: BOOKED_BY[detail.bookedBy] },
    {
      label: "Duración",
      value: formatMinutes(minutesBetween(detail.startsAt, detail.endsAt)),
    },
    { label: "Profesional", value: detail.staffName },
    { label: "Valor del servicio", value: formatCOP(detail.price) },
    ...(detail.clientPhone
      ? [{ label: "Celular", value: formatPhone(detail.clientPhone) }]
      : []),
    {
      label: "Reputación del cliente",
      value: reputationText(detail.reputation),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        ref={contentRef}
        // El foco va a la ventana y no al primer botón: "A tiempo" o "Cancelar cita" con el anillo
        // parecen ya elegidos.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
        className="max-h-[90dvh] gap-5 overflow-y-auto px-5 pb-6 pt-10 focus:outline-none"
      >
        <div className="flex flex-col gap-1">
          <DialogTitle className="text-18 font-bold text-ink first-letter:uppercase">
            {formatLongDate(detail.startsAt)}
          </DialogTitle>
          <DialogDescription className="text-16 text-ink">
            {formatTime(detail.startsAt)} - {formatTime(detail.endsAt)}
          </DialogDescription>
        </div>
        <p className="text-16 text-primary">
          Cita con: <span className="font-bold">{detail.clientName}</span>
        </p>
        {!active && (
          <p
            role="status"
            className="rounded-card bg-soft px-4 py-3 text-14 text-ink"
          >
            Esta cita se canceló.
          </p>
        )}
        <DetailRows rows={rows} />

        {(detail.canModify || detail.canCancel) && (
          <div className="flex gap-3">
            {detail.canModify && (
              <Button asChild variant="outline" className="flex-1">
                <Link href={`/pro/agenda/nueva?modificar=${detail.id}`}>
                  Modificar cita
                </Link>
              </Button>
            )}
            {detail.canCancel && (
              <CancelButton
                bookingId={detail.id}
                inSeries={detail.inSeries}
                onDone={close}
              />
            )}
          </div>
        )}
        {detail.lockedReason && (
          <p className="text-center text-14 text-slate">
            {detail.lockedReason}
          </p>
        )}

        {active && detail.started && (
          <>
            <PunctualityPicker
              bookingId={detail.id}
              value={detail.punctuality}
            />
            <BookingInvoiceActions
              bookingId={detail.id}
              punctuality={detail.punctuality}
              invoice={detail.invoice}
              invoiced={detail.invoiced}
              canInvoice={detail.canInvoice}
            />
          </>
        )}
        <NoteEditor bookingId={detail.id} note={detail.note} />
        {detail.canBlockClient && detail.clientId && (
          <BlockClientButton
            clientId={detail.clientId}
            name={detail.clientName}
            blocked={detail.clientBlocked}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
