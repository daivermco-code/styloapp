import { ChevronRight, CircleAlert } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { TeamMember } from "../types/team";
import { DeactivateStaffButton } from "./deactivate-staff-button";

function MissingBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-12 font-bold text-ink">
      <CircleAlert className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

// Lista de Equipo (US-012 y US-013): cada persona lleva a su ficha (horario y servicios) y avisa
// si le falta algo para salir en las reservas. Los profesionales se pueden desactivar.
export function TeamList({
  members,
  ownerLabel,
}: {
  members: TeamMember[];
  /** "Dueña" o "Dueño", como el saludo del inicio. */
  ownerLabel: string;
}) {
  return (
    <ul className="divide-y divide-line">
      {members.map((member) => (
        <li key={member.id} className="flex items-center gap-2 py-2">
          <Link
            href={`/pro/configurar/equipo/${member.id}`}
            className="-ml-2 flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-card px-2 py-2 transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar className="size-12 text-20">
              <AvatarFallback>{member.displayName.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-16 font-bold text-ink">
                {member.displayName}
              </span>
              <span className="text-14 text-slate">
                {member.role === "owner" ? `${ownerLabel} · Tú` : "Profesional"}
              </span>
              {(!member.hasHours || !member.hasServices) && (
                <span className="flex flex-wrap gap-1">
                  {!member.hasHours && <MissingBadge>Sin horario</MissingBadge>}
                  {!member.hasServices && (
                    <MissingBadge>Sin servicios</MissingBadge>
                  )}
                </span>
              )}
            </span>
            <ChevronRight className="size-5 shrink-0 text-slate" />
          </Link>
          {member.role === "staff" && (
            <DeactivateStaffButton
              staffId={member.id}
              name={member.displayName}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
