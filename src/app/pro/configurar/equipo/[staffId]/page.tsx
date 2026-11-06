import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/features/business/services/queries";
import {
  StaffSettings,
  toStaffTab,
} from "@/features/team/components/staff-settings";
import { StaffSwitcher } from "@/features/team/components/staff-switcher";
import { getTeam } from "@/features/team/services/queries";
import { TopBar } from "@/shared/components/top-bar";
import { PendingArea } from "@/shared/components/instant-nav";
import { RowsSkeleton } from "@/shared/components/page-skeleton";
import { NAV_GROUP } from "@/shared/lib/instant-nav";

export const metadata: Metadata = { title: "Configurar profesional" };

// Ficha de cada persona del equipo (T-2.4.2, US-013, capturas 175 a 179): pestañas de horario,
// servicios con su duración, y precio y comisión (US-037). La pestaña va en la URL.
export default async function StaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ staffId: string }>;
  searchParams: Promise<{ pestana?: string }>;
}) {
  const [{ staffId }, { pestana }] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(staffId).success) notFound();
  const path = `/pro/configurar/equipo/${staffId}`;
  const owner = await requireOwner(path);
  const team = (await getTeam(owner.business.id)).filter(
    (member) => member.isActive,
  );
  const member = team.find((person) => person.id === staffId);
  if (!member) notFound();
  const tab = toStaffTab(pestana);

  return (
    <div className="min-h-dvh bg-surface">
      <TopBar
        title="Configurar profesionales"
        backHref="/pro/configurar/equipo"
      />
      <main className="mx-auto flex max-w-[720px] flex-col gap-4 px-5 pb-24 pt-4 md:px-6">
        <StaffSwitcher
          members={team}
          selectedId={member.id}
          query={tab === "horario" ? "" : `?pestana=${tab}`}
        />
        <PendingArea
          groups={[NAV_GROUP.staffSwitcher]}
          fallback={<RowsSkeleton />}
        >
          <StaffSettings
            businessId={owner.business.id}
            staffId={member.id}
            name={member.displayName}
            tab={tab}
            path={path}
            self={false}
          />
        </PendingArea>
      </main>
    </div>
  );
}
