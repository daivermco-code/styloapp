import { ChevronRight, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { requireOwner } from "@/features/business/services/queries";
import { LinkCodeCard } from "@/features/team/components/link-code-card";
import { TeamList } from "@/features/team/components/team-list";
import { getLinkCode, getTeam } from "@/features/team/services/queries";
import { TopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Equipo" };

// Cupo de la demo: 5 profesionales activos además del dueño (link_staff, Fase 1).
const TEAM_LIMIT = 5;

// Equipo (T-2.4.1, US-012, capturas 68 y 69): el código para vincular con su QR, los permisos del
// equipo (US-038), quién está en el equipo y quiénes se desactivaron.
export default async function TeamPage() {
  const owner = await requireOwner("/pro/configurar/equipo");
  const [code, team] = await Promise.all([
    getLinkCode(owner.business.id),
    getTeam(owner.business.id),
  ]);
  const active = team.filter((member) => member.isActive);
  const inactive = team.filter((member) => !member.isActive);
  const professionals = active.filter((member) => member.role === "staff");

  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title="Equipo" backHref="/pro/configurar" />
      <main className="mx-auto flex max-w-[720px] flex-col gap-6 px-5 pb-24 pt-5 md:px-6">
        {code && <LinkCodeCard code={code} />}

        <Link
          href="/pro/configurar/permisos"
          className="-mx-3 flex min-h-16 items-center gap-4 rounded-card px-3 py-3 transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Lock className="size-7 shrink-0 text-primary" strokeWidth={1.7} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-18 text-ink">Permisos del equipo</span>
            <span className="text-14 text-slate">
              Qué pueden hacer tus profesionales: clientes, facturas, citas y
              bloqueos
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-slate" />
        </Link>

        <section aria-labelledby="equipo" className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="equipo" className="text-18 font-bold text-secondary">
              Tu equipo
            </h2>
            <p className="text-14 text-slate">
              {professionals.length} de {TEAM_LIMIT} profesionales
            </p>
          </div>
          <p className="text-14 text-slate">
            Toca a cada persona para ponerle su horario y los servicios que
            hace. Sin eso no sale para reservar.
          </p>
          <TeamList members={active} ownerLabel={owner.roleLabel} />
        </section>

        {inactive.length > 0 && (
          <section
            aria-labelledby="desactivados"
            className="flex flex-col gap-1"
          >
            <h2 id="desactivados" className="text-18 font-bold text-secondary">
              Desactivados
            </h2>
            <p className="text-14 text-slate">
              No salen para reservas nuevas. Para volver, escriben otra vez el
              código del negocio.
            </p>
            <ul className="divide-y divide-line">
              {inactive.map((member) => (
                <li
                  key={member.id}
                  className="flex min-h-16 items-center gap-3 py-2"
                >
                  <Avatar className="size-12 text-20 opacity-60">
                    <AvatarFallback>
                      {member.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-16 text-slate">
                    {member.displayName}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
