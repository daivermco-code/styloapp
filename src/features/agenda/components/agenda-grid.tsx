"use client";

import { useRouter } from "next/navigation";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/components/empty-state";
import { todayInBogota } from "@/shared/lib/dates";
import { useLongPress } from "../hooks/use-long-press";
import {
  minuteOfDay,
  PX_PER_MINUTE,
  placeInGrid,
  quarterAt,
} from "../lib/grid";
import { fromMinutes } from "../lib/hours";
import type { AgendaBlock, AgendaDay } from "../types/agenda";
import {
  CLOSED_DAY,
  NO_BLOCK_PERMISSION,
  NO_BOOKING_PERMISSION,
  NO_COLUMNS,
} from "../types/messages";
import { BlockMode } from "./block-mode";
import { BookingCard } from "./booking-card";
import {
  BlockTile,
  ColumnHeader,
  HOURS_COLUMN_PX,
  HoursColumn,
  QuarterLines,
} from "./grid-parts";
import { RemoveBlockDialog } from "./remove-block-dialog";

const MIN_COLUMN_PX = 120;

interface AgendaGridProps {
  agenda: AgendaDay;
  canBook: boolean;
  /** Mantener presionado abre el modo de bloqueo (US-021); sin el permiso, avisa. */
  canBlock?: boolean;
  /** En el editor la grilla es de referencia: tocar un espacio libre no hace nada. */
  interactive?: boolean;
}

// Grilla del día (T-3.3.2, US-015 y US-016): columna de horas fija y una columna por profesional,
// 30 px cada cuarto de hora. Se desplaza en los dos sentidos dentro de su caja, así la fila de
// profesionales y la columna de horas se quedan quietas. Tocar un espacio libre abre el editor
// con ese profesional, ese día y esa hora; sin permiso de agendar, avisa. Mantenerlo presionado
// abre el modo de bloqueo en esa columna, y tocar un bloqueo ofrece quitarlo (T-4.2.1).
export function AgendaGrid({
  agenda,
  canBook,
  canBlock = false,
  interactive = true,
}: AgendaGridProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { range, columns, day } = agenda;
  const [blocking, setBlocking] = useState<{
    staffId: string;
    minute: number;
  } | null>(null);
  const [removing, setRemoving] = useState<AgendaBlock | null>(null);
  const longPress = useLongPress<string>((staffId, offsetY) => {
    if (!range) return;
    if (!canBlock) {
      toast.error(NO_BLOCK_PERMISSION);
      return;
    }
    setBlocking({ staffId, minute: quarterAt(range, offsetY) });
  });

  // Si el día es hoy, abre en la hora actual (un cuarto antes, para ver lo que acaba de pasar).
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || !range) return;
    const now = new Date().toISOString();
    if (todayInBogota(now) !== day) return;
    const minute = minuteOfDay(now, day);
    box.scrollTop = Math.max(0, (minute - 15 - range.start) * PX_PER_MINUTE);
  }, [day, range]);

  if (columns.length === 0) return <EmptyState message={NO_COLUMNS} />;
  if (!range) return <EmptyState message={CLOSED_DAY} />;

  const height = (range.end - range.start) * PX_PER_MINUTE;
  const template = `${HOURS_COLUMN_PX}px repeat(${columns.length}, minmax(${MIN_COLUMN_PX}px, 1fr))`;
  const blockingColumn = columns.find(
    (column) => column.id === blocking?.staffId,
  );

  function handleFreeTap(event: MouseEvent<HTMLDivElement>, staffId: string) {
    // El clic que sigue a soltar después de mantener presionado no abre el editor.
    if (longPress.consumeClick()) return;
    if (
      !interactive ||
      !range ||
      (event.target as HTMLElement).closest("a, button, [data-block]")
    ) {
      return;
    }
    if (!canBook) {
      toast.error(NO_BOOKING_PERMISSION);
      return;
    }
    const offset =
      event.clientY - event.currentTarget.getBoundingClientRect().top;
    const params = new URLSearchParams({
      dia: day,
      profesional: staffId,
      hora: fromMinutes(quarterAt(range, offset)),
    });
    router.push(`/pro/agenda/nueva?${params}`);
  }

  return (
    <div
      ref={scrollRef}
      data-testid="agenda-grilla"
      className="relative min-h-0 flex-1 overflow-auto overscroll-contain"
    >
      <div
        className="grid w-full pb-20"
        style={{
          gridTemplateColumns: template,
          minWidth: HOURS_COLUMN_PX + columns.length * MIN_COLUMN_PX,
        }}
      >
        <div className="sticky left-0 top-0 z-30 border-b border-line bg-surface" />
        {columns.map((column) => (
          <div
            key={column.id}
            className="sticky top-0 z-20 min-w-0 border-b border-l border-line bg-surface"
          >
            <ColumnHeader column={column} />
          </div>
        ))}

        {/* Aire para la mitad de arriba de la primera hora, que va sobre su línea. */}
        <div aria-hidden className="sticky left-0 z-10 h-4 bg-surface" />
        {columns.map((column) => (
          <div
            key={column.id}
            aria-hidden
            className="h-4 border-l border-line"
          />
        ))}

        <HoursColumn range={range} height={height} />
        {columns.map((column) => (
          <div
            key={column.id}
            data-staff={column.id}
            onClick={(event) => handleFreeTap(event, column.id)}
            {...(interactive ? longPress.bind(column.id) : {})}
            className={cn(
              "relative min-w-0 border-l border-line",
              // Mantener presionado no selecciona texto ni abre el menú de iOS.
              interactive &&
                "cursor-pointer select-none [-webkit-touch-callout:none]",
            )}
            style={{ height }}
          >
            <QuarterLines range={range} />
            {agenda.blocks
              .filter((block) => block.staffId === column.id)
              .map((block) => (
                <BlockTile
                  key={block.id}
                  block={block}
                  day={day}
                  range={range}
                  onTap={
                    interactive && canBlock
                      ? () => setRemoving(block)
                      : undefined
                  }
                />
              ))}
            {agenda.bookings
              .filter((booking) => booking.staffId === column.id)
              .map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  href={`/pro/agenda?dia=${day}&cita=${booking.id}`}
                  {...placeInGrid(range, booking, day)}
                />
              ))}
          </div>
        ))}
      </div>

      {blocking && blockingColumn && (
        <BlockMode
          agenda={{ ...agenda, range }}
          column={blockingColumn}
          pressedMinute={blocking.minute}
          onClose={() => setBlocking(null)}
        />
      )}
      <RemoveBlockDialog
        block={removing}
        day={day}
        onOpenChange={(open) => !open && setRemoving(null)}
      />
    </div>
  );
}
