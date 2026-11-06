import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { InstantLink } from "@/shared/components/instant-nav";
import { NAV_GROUP } from "@/shared/lib/instant-nav";
import {
  type Period,
  PERIOD_NAMES,
  PERIODS,
  periodLabel,
  shiftPeriod,
} from "@/shared/lib/periods";

interface PeriodPickerProps {
  period: Period;
  /** Un día del periodo que se mira ("YYYY-MM-DD" de Bogotá). */
  day: string;
  /** Los que se ofrecen: los cinco en Facturas; Día, Semana y Mes en Gastos. */
  periods?: readonly Period[];
  /** La dirección de la pantalla con otro periodo o día, sin perder lo demás que se mira. */
  hrefFor: (period: Period, day: string) => string;
  /** Pastillas (Facturas) o pestañas subrayadas a todo el ancho (Gastos, captura 33). */
  variant?: "pills" | "underline";
  /**
   * Un rango propio (Informes, "Filtrar: Rango"): ningún periodo queda elegido y este renglón va
   * en lugar de las flechas.
   */
  range?: ReactNode;
}

type OptionsProps = Omit<Required<PeriodPickerProps>, "variant" | "range"> & {
  /** Con un rango propio, ninguno va elegido. */
  ranged: boolean;
};

const ARROW =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function PeriodPills({ period, day, periods, hrefFor, ranged }: OptionsProps) {
  return (
    // Celular primero: los cinco caben en una fila desde 360 px; desde sm, más aire.
    <nav
      aria-label="Periodo"
      className="flex flex-wrap justify-center gap-1 sm:gap-2"
    >
      {periods.map((option) => {
        const selected = !ranged && option === period;
        return (
          <InstantLink
            key={option}
            href={hrefFor(option, day)}
            group={NAV_GROUP.period}
            selected={selected}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full border px-2.5 text-14 font-bold transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
            selectedClassName="border-primary bg-primary text-surface"
            idleClassName="border-line text-slate hover:bg-primary-50"
          >
            {PERIOD_NAMES[option]}
          </InstantLink>
        );
      })}
    </nav>
  );
}

function PeriodTabs({ period, day, periods, hrefFor, ranged }: OptionsProps) {
  return (
    // Como la captura 33: cada pestaña ocupa su parte, con la raya de abajo; la elegida, en
    // principal y más gruesa.
    <nav aria-label="Periodo" className="grid auto-cols-fr grid-flow-col gap-3">
      {periods.map((option) => {
        const selected = !ranged && option === period;
        return (
          <InstantLink
            key={option}
            href={hrefFor(option, day)}
            group={NAV_GROUP.period}
            selected={selected}
            className="flex min-h-11 items-center justify-center border-b-2 px-1 text-16 font-bold transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            selectedClassName="border-primary text-primary"
            idleClassName="border-line text-slate hover:text-primary"
          >
            {PERIOD_NAMES[option]}
          </InstantLink>
        );
      })}
    </nav>
  );
}

// Selector de periodo (T-8.1.2, UI A.1) de Facturas, Gastos y el liquidador: pastillas con los
// periodos y, debajo, las flechas de 44 px con la fecha escrita en 14. Todo son enlaces: el
// periodo queda en la URL y se puede recargar o volver. Responden al tocarlos (Fase 17): la página
// tapa su lista con PendingArea de los grupos `period` y `periodShift`.
export function PeriodPicker({
  period,
  day,
  periods = PERIODS,
  hrefFor,
  variant = "pills",
  range,
}: PeriodPickerProps) {
  const Options = variant === "underline" ? PeriodTabs : PeriodPills;
  return (
    <div className="flex flex-col gap-2">
      <Options
        period={period}
        day={day}
        periods={periods}
        hrefFor={hrefFor}
        ranged={range !== undefined}
      />
      {range ?? (
        <div className="flex items-center justify-between gap-1">
          <InstantLink
            href={hrefFor(period, shiftPeriod(period, day, -1))}
            group={NAV_GROUP.periodShift}
            selectable={false}
            aria-label="Periodo anterior"
            className={ARROW}
          >
            <ChevronLeft className="size-6" />
          </InstantLink>
          <p className="text-center text-14 text-ink" aria-live="polite">
            {periodLabel(period, day)}
          </p>
          <InstantLink
            href={hrefFor(period, shiftPeriod(period, day, 1))}
            group={NAV_GROUP.periodShift}
            selectable={false}
            aria-label="Periodo siguiente"
            className={ARROW}
          >
            <ChevronRight className="size-6" />
          </InstantLink>
        </div>
      )}
    </div>
  );
}
