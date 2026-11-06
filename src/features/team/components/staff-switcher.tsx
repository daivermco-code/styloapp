import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { InstantLink } from "@/shared/components/instant-nav";
import { NAV_GROUP } from "@/shared/lib/instant-nav";
import type { TeamMember } from "../types/team";

interface StaffSwitcherProps {
  members: TeamMember[];
  selectedId: string;
  /** La pestaña abierta, para seguir en ella al cambiar de persona. */
  query: string;
}

// Fila de avatares de la ficha (capturas 175 a 179): se elige a quién configurar; el elegido
// lleva el aro petróleo profundo y su nombre en verde. Responde al tocarla (Fase 17): el aro pasa
// de una, por `aria-current`, y la página tapa la configuración con su esqueleto.
export function StaffSwitcher({
  members,
  selectedId,
  query,
}: StaffSwitcherProps) {
  return (
    <nav aria-label="Elegir a quién configurar" className="-mx-5 md:-mx-6">
      <ul className="flex gap-4 overflow-x-auto px-5 py-1 md:px-6">
        {members.map((member) => {
          const selected = member.id === selectedId;
          return (
            <li key={member.id} className="shrink-0">
              <InstantLink
                href={`/pro/configurar/equipo/${member.id}${query}`}
                group={NAV_GROUP.staffSwitcher}
                selected={selected}
                className="group flex w-[76px] flex-col items-center gap-1 rounded-card py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="size-14 text-25 group-aria-[current=page]:ring-[3px] group-aria-[current=page]:ring-secondary group-aria-[current=page]:ring-offset-2">
                  <AvatarFallback>
                    {member.displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="w-full truncate text-center text-14 text-ink group-aria-[current=page]:font-bold group-aria-[current=page]:text-primary">
                  {member.displayName}
                </span>
              </InstantLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
