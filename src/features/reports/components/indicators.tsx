import { Skeleton } from "@/components/ui/skeleton";
import { generalSales, utilities, variation } from "../lib/numbers";
import { getSummaryPair, type ReportArgs } from "../services/queries";
import type { ReportRange } from "../types/report";
import { IndicatorCard } from "./indicator-card";
import { Variation } from "./variation";

interface IndicatorsProps {
  args: ReportArgs;
  /** El periodo de antes, para la variación. */
  previous: ReportRange;
  /** El profesional ve sus 4 indicadores, con Pago de comisiones a todo el ancho. */
  side: "owner" | "staff";
}

export const GRID = "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4";

// Indicadores generales (T-13.1.2, US-052, Pantallas 19 y 22). Pide lo de ahora y lo de antes en
// paralelo. Gastos y Utilidades son del negocio: no salen con un profesional elegido ni para el
// profesional (la base le manda Gastos en null), y una línea dice por qué.
export async function Indicators({ args, previous, side }: IndicatorsProps) {
  const pair = await getSummaryPair(args, previous);
  const { current } = pair;
  const businessWide = side === "owner" && current.expenses !== null;
  const vary = (
    pick: (summary: typeof current) => number,
    risingIsBad = false,
  ) => (
    <Variation
      value={variation(pick(current), pick(pair.previous))}
      risingIsBad={risingIsBad}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className={GRID}>
        <IndicatorCard
          title="Ventas generales"
          value={generalSales(current)}
          footer={vary(generalSales)}
          featured
        />
        <IndicatorCard
          title="Venta de servicios"
          value={current.services}
          footer={vary((summary) => summary.services)}
        />
        <IndicatorCard
          title="Venta de productos"
          value={current.products}
          footer={<p className="text-12 text-slate">Llegan después</p>}
        />
        {businessWide && (
          <IndicatorCard
            title="Gastos"
            value={current.expenses ?? 0}
            footer={vary((summary) => summary.expenses ?? 0, true)}
          />
        )}
        <IndicatorCard
          title="Pago de comisiones"
          value={current.commissions}
          footer={vary((summary) => summary.commissions, true)}
          featured={side === "staff"}
        />
        {businessWide && (
          <IndicatorCard
            title="Utilidades"
            value={utilities(current)}
            footer={vary(utilities)}
            featured
          />
        )}
      </div>
      {side === "owner" && !businessWide && (
        <p className="px-1 text-center text-14 text-slate">
          Gastos y utilidades son del negocio: elige Todos para verlos.
        </p>
      )}
    </div>
  );
}

/** Mientras llegan: las 6 tarjetas en gris, con la misma forma. */
export function IndicatorsSkeleton() {
  return (
    <div className={GRID} aria-busy="true" aria-label="Cargando los informes">
      {[true, false, false, false, false, true].map((featured, index) => (
        <Skeleton
          key={index}
          className={
            featured
              ? "col-span-2 h-[148px] rounded-sheet md:col-span-3"
              : "h-[148px] rounded-sheet"
          }
        />
      ))}
    </div>
  );
}
