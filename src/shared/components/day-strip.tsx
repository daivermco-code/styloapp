"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { addDays, weekdayOf } from "@/shared/lib/dates";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

// Días que se ven alrededor del elegido: tres semanas atrás y seis adelante.
const DAYS_BEFORE = 21;
const DAYS_AFTER = 42;

// La pastilla de 30 px va en ::before y el botón mide 44 para tocar (US-034); el margen negativo
// lo deja ocupar lo mismo de antes.
const CHIP_CLASSES =
  "relative isolate -my-[7px] h-11 w-auto gap-2 rounded-full border-0 bg-transparent px-4 text-16 font-bold text-surface before:absolute before:inset-x-0 before:inset-y-[7px] before:-z-10 before:rounded-full before:bg-primary focus:border-0 focus:px-4 focus:ring-2 focus:ring-ring focus:ring-offset-2 [&>svg:last-child]:hidden";

interface DayStripProps {
  /** Día elegido, "YYYY-MM-DD". */
  selected: string;
  /** Hoy en Bogotá (lo pone el servidor, así el navegador pinta lo mismo). */
  today: string;
  onSelect: (day: string) => void;
  /** Sin días antes de este (la reserva del cliente empieza hoy). */
  minDay?: string;
  className?: string;
}

/** El primer día del mes elegido, o hoy si es el mes de hoy. */
function monthStart(year: number, month: number, today: string): string {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  return today.startsWith(start.slice(0, 7)) ? today : start;
}

// Barra de días compartida (T-3.3.1; la usan la agenda, el editor y, en la Fase 5, la reserva del
// cliente, desde hoy con `minDay`): chips de año y mes y el carrusel de días. El elegido va
// relleno; hoy dice "Hoy" y lleva el punto del monograma; sobre los días de otro mes sale el
// nombre de ese mes.
export function DayStrip({
  selected,
  today,
  onSelect,
  minDay,
  className,
}: DayStripProps) {
  const hydrated = useHydrated();
  const listRef = useRef<HTMLDivElement>(null);
  const [year, month] = selected.split("-").map(Number);
  const days = Array.from(
    { length: DAYS_BEFORE + DAYS_AFTER + 1 },
    (_, index) => addDays(selected, index - DAYS_BEFORE),
  ).filter((day) => !minDay || day >= minDay);
  const todayYear = Number(today.slice(0, 4));
  const years = [todayYear - 1, todayYear, todayYear + 1].filter(
    (option) => !minDay || option >= Number(minDay.slice(0, 4)),
  );
  const choose = (day: string) =>
    onSelect(minDay && day < minDay ? minDay : day);

  // El elegido queda en el centro del carrusel.
  useEffect(() => {
    const list = listRef.current;
    const chosen = list?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (!list || !chosen) return;
    list.scrollLeft =
      chosen.offsetLeft - list.clientWidth / 2 + chosen.clientWidth / 2;
  }, [selected]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex justify-center gap-3">
        <Select
          value={String(year)}
          onValueChange={(value) =>
            choose(monthStart(Number(value), month, today))
          }
        >
          <SelectTrigger aria-label="Año" className={CHIP_CLASSES}>
            <RefreshCw className="size-4" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(month)}
          onValueChange={(value) =>
            choose(monthStart(year, Number(value), today))
          }
        >
          <SelectTrigger aria-label="Mes" className={CHIP_CLASSES}>
            <RefreshCw className="size-4" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {MONTHS.map((name, index) => (
              <SelectItem key={name} value={String(index + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        ref={listRef}
        role="group"
        aria-label="Días"
        className="relative flex overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {days.map((day) => {
          const isSelected = day === selected;
          const isToday = day === today;
          const otherMonth = Number(day.slice(5, 7)) !== month;
          return (
            <button
              key={day}
              type="button"
              disabled={!hydrated}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${isToday ? "Hoy, " : ""}${WEEKDAYS[weekdayOf(day)]} ${Number(day.slice(8))} de ${MONTHS[Number(day.slice(5, 7)) - 1].toLowerCase()}`}
              onClick={() => choose(day)}
              className="flex w-[67px] shrink-0 flex-col items-center gap-1 rounded-card py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
            >
              <span
                className={cn(
                  "h-4 text-12 text-primary",
                  !otherMonth && "invisible",
                )}
              >
                {MONTHS[Number(day.slice(5, 7)) - 1]}
              </span>
              <span
                className={cn(
                  "relative flex size-[52px] items-center justify-center rounded-full border-2 border-primary text-22 transition-colors duration-120",
                  isSelected
                    ? "bg-primary font-bold text-surface"
                    : "text-primary hover:bg-primary-50",
                )}
              >
                {Number(day.slice(8))}
                {isToday && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute bottom-1.5 right-1.5 size-1.5 rounded-full",
                      isSelected ? "bg-surface" : "bg-primary",
                    )}
                  />
                )}
              </span>
              <span
                className={cn(
                  "text-13",
                  isToday ? "font-bold text-primary" : "text-slate",
                )}
              >
                {isToday ? "Hoy" : WEEKDAYS[weekdayOf(day)]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
