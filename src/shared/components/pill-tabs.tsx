import { InstantLink } from "@/shared/components/instant-nav";
import { NAV_GROUP } from "@/shared/lib/instant-nav";

export interface PillTab {
  label: string;
  href: string;
  selected: boolean;
  /** Número entre paréntesis al lado del nombre (Activos (12)). */
  total?: number;
}

// Pestañas en pastilla de la app del negocio (servicios, ficha del profesional, cuenta): cada una
// es un enlace, así la pestaña queda en la URL y se puede recargar. Responden al tocarlas (Fase 17):
// lo de debajo va en un PendingArea del grupo `tabs`.
export function PillTabs({ label, tabs }: { label: string; tabs: PillTab[] }) {
  return (
    <nav
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-soft p-1"
    >
      {tabs.map((tab) => (
        <InstantLink
          key={tab.label}
          href={tab.href}
          group={NAV_GROUP.tabs}
          selected={tab.selected}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-full px-2 text-center text-16 font-bold leading-tight transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          selectedClassName="bg-primary text-surface"
          idleClassName="text-slate hover:bg-primary-50"
        >
          {tab.label}
          {tab.total !== undefined && (
            <span className="text-14 font-medium">({tab.total})</span>
          )}
        </InstantLink>
      ))}
    </nav>
  );
}
