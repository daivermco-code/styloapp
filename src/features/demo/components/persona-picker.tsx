"use client";

import {
  ChevronDown,
  Scissors,
  Store,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { DemoSide } from "@/features/auth/services/queries";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import type { DemoPersona } from "../services/queries";

interface SideCard {
  side: DemoSide;
  title: string;
  phrase: string;
  icon: LucideIcon;
}

const SIDES: SideCard[] = [
  {
    side: "owner",
    title: "Negocio",
    phrase: "El dueño, su agenda y su equipo",
    icon: Store,
  },
  {
    side: "staff",
    title: "Profesional",
    phrase: "Su agenda y su horario",
    icon: Scissors,
  },
  {
    side: "client",
    title: "Cliente",
    phrase: "Explora, reserva y califica",
    icon: UserRound,
  },
];

// Las tres entradas de la demo (US-002). Al tocar una se despliegan sus personas; cada
// persona abre /entrar con su celular ya escrito. Hasta que React toma la página los lados no
// se despliegan, así que quedan desactivados (se ven igual).
export function PersonaPicker({ personas }: { personas: DemoPersona[] }) {
  const [open, setOpen] = useState<DemoSide | null>(null);
  const hydrated = useHydrated();

  return (
    <ul className="flex flex-col gap-3">
      {SIDES.map(({ side, title, phrase, icon: Icon }) => {
        const expanded = open === side;
        const people = personas.filter((p) => p.side === side);
        return (
          <li key={side} className="rounded-card bg-surface shadow-card">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`personas-${side}`}
              disabled={!hydrated}
              onClick={() => setOpen(expanded ? null : side)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <Icon
                className="size-[30px] shrink-0 text-primary"
                strokeWidth={1.8}
              />
              <span className="flex-1">
                <span className="block text-18 font-bold text-primary">
                  {title}
                </span>
                <span className="block text-14 text-slate">{phrase}</span>
              </span>
              <ChevronDown
                className={cn(
                  "size-5 text-slate transition-transform duration-120",
                  expanded && "rotate-180",
                )}
              />
            </button>
            {expanded && (
              <ul
                id={`personas-${side}`}
                className="divide-y divide-line border-t border-line px-4"
              >
                {people.map((person) => (
                  <li key={person.id}>
                    <Link
                      href={`/entrar?persona=${person.id}`}
                      className="flex min-h-14 items-center gap-3 py-2"
                    >
                      <Avatar className="h-10 w-10 text-16">
                        <AvatarFallback>{person.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block truncate text-16 text-ink">
                          {person.name}
                        </span>
                        {side !== "client" && (
                          <span className="block truncate text-12 text-slate">
                            {person.businessName ?? "Sin negocio todavía"}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
