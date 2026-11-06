// Piezas de la grilla que comparten la agenda y el modo de bloqueo (Fase 4).
import { cn } from "@/lib/utils";
import {
  type GridRange,
  minuteOfDay,
  placeInGrid,
  QUARTER_PX,
} from "../lib/grid";
import { formatClock, fromMinutes } from "../lib/hours";
import type { AgendaBlock, AgendaColumn } from "../types/agenda";

export const HOURS_COLUMN_PX = 56;

/** Rayas del bloqueo, como en el diseño. */
export const BLOCK_HATCH =
  "bg-[repeating-linear-gradient(135deg,rgb(var(--line))_0_2px,rgb(var(--surface))_2px_8px)]";

/** "9:30 a 10:00 a. m." o "11:30 a. m. a 1:00 p. m." (minutos desde la medianoche). */
export function clockRange(starts: number, ends: number): string {
  const from = formatClock(fromMinutes(starts));
  const to = formatClock(fromMinutes(ends));
  const sameHalf = from.slice(-5) === to.slice(-5);
  return `${sameHalf ? from.slice(0, -6) : from} a ${to}`;
}

/** "9:00" arriba y "a. m." debajo, como en la columna de horas del diseño. */
function HourLabel({ minute }: { minute: number }) {
  const text = formatClock(fromMinutes(minute));
  const space = text.indexOf(" ");
  return (
    <>
      <span>{text.slice(0, space)}</span>
      <span>{text.slice(space + 1)}</span>
    </>
  );
}

/**
 * Columna de horas (captura 11): la hora en punto y sus cuartos (15, 30 y 45). La primera línea de
 * cada rótulo va centrada en su línea (media altura de línea, 0.5em con leading-none) y "a. m."
 * cuelga debajo sin tocar el "15". La grilla siempre empieza en una hora en punto.
 */
export function HoursColumn({
  range,
  height,
}: {
  range: GridRange;
  height: number;
}) {
  const quarters = (range.end - range.start) / 15;
  return (
    <div className="sticky left-0 z-10 bg-surface" style={{ height }}>
      {Array.from({ length: quarters }, (_, index) => {
        const minute = range.start + index * 15;
        const onTheHour = index % 4 === 0;
        return (
          <div
            key={minute}
            aria-hidden={!onTheHour}
            className="absolute right-2 flex -translate-y-[0.5em] flex-col items-end text-12 leading-none text-slate"
            style={{ top: index * QUARTER_PX }}
          >
            {onTheHour ? (
              <HourLabel minute={minute} />
            ) : (
              <span>{minute % 60}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Líneas de la grilla: la hora en punto continua, los cuartos punteados. */
export function QuarterLines({ range }: { range: GridRange }) {
  const quarters = (range.end - range.start) / 15;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: quarters }, (_, index) => (
        <div
          key={index}
          style={{ height: QUARTER_PX }}
          className={cn(
            "border-t border-line last:border-b last:border-b-line",
            index % 4 !== 0 && "border-dashed",
          )}
        />
      ))}
    </div>
  );
}

interface BlockTileProps {
  block: AgendaBlock;
  day: string;
  range: GridRange;
  /** Tocarlo ofrece quitarlo (US-021); sin esto, solo se ve (la agenda junto al editor). */
  onTap?: () => void;
}

/** Un bloqueo en la grilla: rayado, con "Bloqueado". */
export function BlockTile({ block, day, range, onTap }: BlockTileProps) {
  const className = cn(
    "absolute inset-x-1 z-[3] flex items-start rounded-booking border border-line px-2 py-1",
    BLOCK_HATCH,
  );
  const label = (
    <span className="rounded-sm bg-surface px-1 text-12 font-medium text-slate">
      Bloqueado
    </span>
  );
  const style = placeInGrid(range, block, day);
  if (!onTap) {
    return (
      <div data-block style={style} className={cn(className, "cursor-default")}>
        {label}
      </div>
    );
  }
  const span = clockRange(
    minuteOfDay(block.startsAt, day),
    minuteOfDay(block.endsAt, day),
  );
  return (
    <button
      type="button"
      data-block
      onClick={onTap}
      aria-label={`Bloqueado de ${span}, quitar bloqueo`}
      style={style}
      className={cn(
        className,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {label}
    </button>
  );
}

export function ColumnHeader({ column }: { column: AgendaColumn }) {
  return (
    <div className="flex flex-col items-center gap-1 px-2 py-2">
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-full bg-primary text-18 font-bold text-surface"
      >
        {column.name.charAt(0).toUpperCase()}
      </span>
      <span className="max-w-full truncate text-14 font-medium text-ink">
        {column.name}
      </span>
    </div>
  );
}
