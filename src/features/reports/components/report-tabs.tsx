import { cn } from "@/lib/utils";
import { InstantLink } from "@/shared/components/instant-nav";
import { NAV_GROUP } from "@/shared/lib/instant-nav";
import { reportsHref } from "../lib/display";
import type { ReportTab, ReportView } from "../lib/filters";

const TAB_NAMES: Record<ReportTab, string> = {
  indicadores: "Indicadores generales",
  ventas: "Ventas",
  comisiones: "Comisiones",
  metodos: "Métodos de pago",
};

interface ReportTabsProps {
  view: ReportView;
  /** Las del dueño (4) o las del profesional (3, centradas). */
  tabs: readonly ReportTab[];
}

// Pestañas cuadradas de Informes (T-13.1.1, UI B.1, capturas 32 y 164): botones de ~55 px de alto,
// esquinas de 6 px y borde de 1 px principal; la elegida, rellena. Son enlaces: la pestaña queda
// en la URL y Atrás vuelve a la de antes.
export function ReportTabs({ view, tabs }: ReportTabsProps) {
  return (
    <nav
      aria-label="Informe"
      className={cn(
        "grid gap-2 sm:gap-4",
        tabs.length === 4
          ? "grid-cols-4"
          : "mx-auto w-full max-w-[420px] grid-cols-3",
      )}
    >
      {tabs.map((tab) => {
        const selected = tab === view.tab;
        return (
          <InstantLink
            key={tab}
            href={reportsHref(view, { tab })}
            group={NAV_GROUP.reportTabs}
            selected={selected}
            className="flex min-h-14 items-center justify-center rounded-booking border border-primary px-1 text-center text-14 leading-tight transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            selectedClassName="bg-primary text-surface"
            idleClassName="bg-surface text-primary hover:bg-primary-50"
          >
            {TAB_NAMES[tab]}
          </InstantLink>
        );
      })}
    </nav>
  );
}
