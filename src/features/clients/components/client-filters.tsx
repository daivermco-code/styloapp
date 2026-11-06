"use client";

import {
  HeartCrack,
  type LucideIcon,
  Search,
  UserRoundSearch,
  UserRoundStar,
  UsersRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { InstantLink, useInstantNav } from "@/shared/components/instant-nav";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { NAV_GROUP } from "@/shared/lib/instant-nav";
import {
  CLIENT_TABS,
  type ClientFilter,
  type ClientTab,
  clientsHref,
  QUERY_MAX,
} from "../lib/tabs";

/** Cuánto se espera a que deje de escribir antes de buscar. */
const SEARCH_DELAY_MS = 250;

const TAB_INFO: Record<ClientTab, { label: string; icon: LucideIcon }> = {
  todos: { label: "Todos", icon: UsersRound },
  mejores: { label: "Mejores clientes", icon: UserRoundStar },
  "no-vuelven": { label: "No han vuelto", icon: HeartCrack },
  "sin-visitas": { label: "Aún no te visitan", icon: UserRoundSearch },
};

const SUBTITLES: Partial<Record<ClientTab, string>> = {
  mejores: "Clientes con más visitas",
  "no-vuelven": "Días desde su última visita",
};

const SUBTITLE_CLASS =
  "flex min-h-11 items-center px-3 text-16 font-bold text-primary";

/**
 * "Próximos cumpleaños" prende y apaga: cambia de una al tocarlo (mientras espera, lo contrario de
 * lo que dice el servidor) y lleva `aria-current` cuando está prendido.
 */
function BirthdaysLink({
  href,
  on,
  onNavigate,
}: {
  href: string;
  on: boolean;
  onNavigate: () => void;
}) {
  const { pending, navigate } = useInstantNav();
  const shown = pending?.group === NAV_GROUP.clientBirthdays ? !on : on;
  return (
    <a
      href={href}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        onNavigate();
        navigate(href, NAV_GROUP.clientBirthdays);
      }}
      aria-current={shown ? "true" : undefined}
      className={cn(
        SUBTITLE_CLASS,
        "rounded-full transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        shown && "bg-primary-50",
      )}
    >
      Próximos cumpleaños
    </a>
  );
}

// Lo de arriba de Clientes (T-10.1.2, pantalla 14, capturas 39 y 76 a 79): el buscador subrayado
// con lupa, las 4 pestañas con ícono y el subtítulo de cada una (en Todos, el botón de los
// próximos cumpleaños). Todo va en la URL y el servidor filtra. Los enlaces llevan lo que está
// escrito en la caja, y al tocarlos se cancela la búsqueda pendiente: así no se pisan. Todo responde
// al tocarlo (Fase 17): la pestaña se marca de una y la lista sale en esqueleto mientras llega.
export function ClientFilters({ filter }: { filter: ClientFilter }) {
  const { navigate } = useInstantNav();
  const hydrated = useHydrated();
  const [query, setQuery] = useState(filter.query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { tab, birthdays } = filter;

  const cancelSearch = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  // Se compara con lo que ya trae la URL: si una navegación llega sin lo escrito, se vuelve a buscar.
  useEffect(() => {
    if (query.trim() === filter.query.trim()) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      navigate(clientsHref({ tab, birthdays, query }), NAV_GROUP.clientSearch);
    }, SEARCH_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [query, filter.query, tab, birthdays, navigate]);

  const live = { tab, birthdays, query };
  const subtitle = SUBTITLES[tab];
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-0 top-1/2 size-6 -translate-y-1/2 text-primary"
        />
        <input
          type="search"
          aria-label="Buscar cliente"
          placeholder="Buscar por nombre o celular"
          value={query}
          maxLength={QUERY_MAX}
          // Lo que se escribe antes de que React tome la página se borraría al tomarla.
          readOnly={!hydrated}
          onChange={(event) => setQuery(event.target.value)}
          className="h-12 w-full border-b border-line bg-transparent pl-9 text-16 text-ink placeholder:text-slate focus-visible:border-b-2 focus-visible:border-primary focus-visible:outline-none"
        />
      </div>

      {/* Cada pestaña ocupa su parte, con la raya de abajo; la elegida, en principal. */}
      <nav aria-label="Pestañas de clientes" className="grid grid-cols-4">
        {CLIENT_TABS.map((option) => {
          const { label, icon: Icon } = TAB_INFO[option];
          const selected = option === tab;
          return (
            <InstantLink
              key={option}
              href={clientsHref({ ...live, tab: option, birthdays: false })}
              group={NAV_GROUP.clients}
              selected={selected}
              onNavigate={cancelSearch}
              className="flex min-h-11 flex-col items-center gap-1 border-b-2 px-1 pb-2 pt-1 text-center text-14 font-bold leading-tight text-primary transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              selectedClassName="border-primary"
              idleClassName="border-transparent hover:border-line"
            >
              <Icon aria-hidden className="size-7" strokeWidth={1.75} />
              {label}
            </InstantLink>
          );
        })}
      </nav>

      <div className="flex justify-end">
        {tab === "todos" ? (
          <BirthdaysLink
            href={clientsHref({ ...live, birthdays: !birthdays })}
            on={birthdays}
            onNavigate={cancelSearch}
          />
        ) : (
          subtitle && <p className={SUBTITLE_CLASS}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}
