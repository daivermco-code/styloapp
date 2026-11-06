import type { Metadata } from "next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { requireOwner } from "@/features/business/services/queries";
import { TeamPermissions } from "@/features/team/components/team-permissions";
import { getTeamPermissions } from "@/features/team/services/queries";
import { TopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Permisos del equipo" };

// Permisos del equipo (T-7.3.2, US-038, pantalla 18, captura 179): lo que pueden hacer todos los
// profesionales. Solo el dueño; el profesional que llega aquí vuelve a su inicio.
export default async function PermissionsPage() {
  const owner = await requireOwner("/pro/configurar/permisos");
  const permissions = await getTeamPermissions(owner.business.id);

  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title="Permisos del equipo" backHref="/pro/configurar/equipo" />
      <main className="mx-auto flex max-w-[720px] flex-col gap-4 px-5 pb-24 pt-5 md:px-6">
        <div className="flex flex-col items-center gap-2">
          <Avatar className="size-[55px] text-16 font-bold">
            <AvatarFallback>Todos</AvatarFallback>
          </Avatar>
          <p className="text-14 text-slate">
            Permisos para todos tus profesionales
          </p>
        </div>
        <TeamPermissions initial={permissions} />
      </main>
    </div>
  );
}
