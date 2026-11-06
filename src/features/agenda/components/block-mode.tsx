"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { formatShortDate } from "@/shared/lib/dates";
import { formatMinutes } from "@/shared/lib/duration";
import {
  type QuarterRange,
  selectionMinutes,
  toggleQuarter,
} from "../lib/blocks";
import {
  type GridRange,
  minuteOfDay,
  placeInGrid,
  QUARTER_PX,
} from "../lib/grid";
import { formatClock, fromMinutes } from "../lib/hours";
import { createBlock } from "../services/block-actions";
import type { AgendaBlock, AgendaColumn, AgendaDay } from "../types/agenda";
import { BookingCard } from "./booking-card";
import {
  BLOCK_HATCH,
  BlockTile,
  clockRange,
  ColumnHeader,
  HOURS_COLUMN_PX,
  HoursColumn,
  QuarterLines,
} from "./grid-parts";
import { RemoveBlockDialog } from "./remove-block-dialog";

interface BlockModeProps {
  agenda: AgendaDay & { range: GridRange };
  column: AgendaColumn;
  /** El cuarto de hora donde se mantuvo presionado (minutos desde la medianoche). */
  pressedMinute: number;
  onClose: () => void;
}

// Modo de bloqueo (T-4.2.1, US-021, Blueprint "Pantallas — Fase 4"): la columna del profesional
// en cuadritos de 15 minutos. Se eligen seguidos y sin citas ("Bloquear 30 min"), el bloqueo queda
// y se pueden cerrar más; tocar un bloqueo ofrece quitarlo. "Listo" o la X salen.
export function BlockMode({
  agenda,
  column,
  pressedMinute,
  onClose,
}: BlockModeProps) {
  const router = useRouter();
  const { range, day } = agenda;
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const quarters = (range.end - range.start) / 15;
  const height = quarters * QUARTER_PX;
  const bookings = agenda.bookings.filter((item) => item.staffId === column.id);
  const blocks = agenda.blocks.filter((item) => item.staffId === column.id);
  const taken = [...bookings, ...blocks].map((item) => ({
    start: minuteOfDay(item.startsAt, day),
    end: minuteOfDay(item.endsAt, day),
  }));
  const isFree = (quarter: number) => {
    const start = range.start + quarter * 15;
    return (
      quarter >= 0 &&
      quarter < quarters &&
      !taken.some((item) => item.start < start + 15 && item.end > start)
    );
  };

  const pressed = (pressedMinute - range.start) / 15;
  const [selection, setSelection] = useState<QuarterRange | null>(() =>
    isFree(pressed) ? { from: pressed, to: pressed } : null,
  );
  const [removing, setRemoving] = useState<AgendaBlock | null>(null);
  const [pending, startTransition] = useActionTransition();

  // Abre donde se mantuvo presionado, con una hora de aire arriba.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, (pressed - 4) * QUARTER_PX);
    }
  }, [pressed]);

  const starts = selection ? range.start + selection.from * 15 : 0;
  const ends = selection ? range.start + (selection.to + 1) * 15 : 0;

  const submit = () => {
    if (!selection) return;
    startTransition(async () => {
      const result = await createBlock({
        staffId: column.id,
        day,
        starts: fromMinutes(starts),
        ends: fromMinutes(ends),
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Espacio bloqueado");
      setSelection(null);
      router.refresh();
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={contentRef}
          // El foco va a la ventana y no a la X: con el anillo parecía elegida (como el detalle).
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current?.focus();
          }}
          className="fixed inset-0 z-50 flex flex-col bg-surface focus:outline-none lg:inset-y-0 lg:left-auto lg:w-[480px] lg:shadow-card"
        >
          <header className="flex min-h-14 items-center gap-1 px-1 shadow-card">
            <DialogClose className="flex size-11 items-center justify-center rounded-full text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="size-6" aria-hidden />
              <span className="sr-only">Salir del modo de bloqueo</span>
            </DialogClose>
            <DialogTitle className="flex-1 text-18 font-bold text-primary">
              Bloquear espacios
            </DialogTitle>
            <DialogClose asChild>
              <Button type="button" variant="ghost" className="text-primary">
                Listo
              </Button>
            </DialogClose>
          </header>
          <DialogDescription className="px-5 pt-3 text-14 text-ink">
            Toca los cuadritos que quieres cerrar.
          </DialogDescription>
          <div
            className="grid border-b border-line"
            style={{ gridTemplateColumns: `${HOURS_COLUMN_PX}px 1fr` }}
          >
            <div />
            <ColumnHeader column={column} />
          </div>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            <div
              className="grid pb-4"
              style={{ gridTemplateColumns: `${HOURS_COLUMN_PX}px 1fr` }}
            >
              <div aria-hidden className="h-4" />
              <div aria-hidden className="h-4 border-l border-line" />
              <HoursColumn range={range} height={height} />
              <div
                role="group"
                aria-label={`Cuadritos de ${column.name}`}
                className="relative border-l border-line"
                style={{ height }}
              >
                <QuarterLines range={range} />
                {selection && (
                  <div
                    aria-hidden
                    className={cn(
                      "absolute inset-x-1 rounded-booking border-2 border-primary",
                      BLOCK_HATCH,
                    )}
                    style={{
                      top: selection.from * QUARTER_PX,
                      height: (selection.to - selection.from + 1) * QUARTER_PX,
                    }}
                  />
                )}
                {Array.from({ length: quarters }, (_, quarter) => {
                  if (!isFree(quarter)) return null;
                  const minute = range.start + quarter * 15;
                  const chosen =
                    selection !== null &&
                    quarter >= selection.from &&
                    quarter <= selection.to;
                  return (
                    <button
                      key={minute}
                      type="button"
                      aria-pressed={chosen}
                      aria-label={formatClock(fromMinutes(minute))}
                      onClick={() =>
                        setSelection((current) =>
                          toggleQuarter(current, quarter, isFree),
                        )
                      }
                      // El tono al pasar el mouse no va sobre la selección (taparía su borde), y
                      // solo donde hay mouse: en el celular se queda pegado después de tocar.
                      className={cn(
                        "absolute inset-x-1 z-[2] rounded-booking transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        !chosen &&
                          "[@media(hover:hover)]:hover:bg-primary-50/60",
                      )}
                      style={{ top: quarter * QUARTER_PX, height: QUARTER_PX }}
                    />
                  );
                })}
                {bookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    {...placeInGrid(range, booking, day)}
                  />
                ))}
                {blocks.map((block) => (
                  <BlockTile
                    key={block.id}
                    block={block}
                    day={day}
                    range={range}
                    onTap={() => setRemoving(block)}
                  />
                ))}
              </div>
            </div>
          </div>

          <footer className="flex flex-col items-center gap-3 border-t border-line px-5 pb-6 pt-3">
            <p
              aria-live="polite"
              className="text-14 text-ink first-letter:uppercase"
            >
              {selection
                ? `${formatShortDate(`${day}T12:00:00-05:00`)} · ${clockRange(starts, ends)}`
                : "Toca un cuadrito para empezar."}
            </p>
            <Button
              type="button"
              onClick={submit}
              disabled={!selection || pending}
              className="w-full max-w-sm"
            >
              {pending && <LoaderCircle className="animate-spin" />}
              {selection
                ? `Bloquear ${formatMinutes(selectionMinutes(selection))}`
                : "Bloquear"}
            </Button>
          </footer>
          <RemoveBlockDialog
            block={removing}
            day={day}
            onOpenChange={(open) => !open && setRemoving(null)}
          />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
