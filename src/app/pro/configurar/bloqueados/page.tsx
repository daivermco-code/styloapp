import type { Metadata } from "next";
import { requireOwner } from "@/features/business/services/queries";
import { BlockedList } from "@/features/clients/components/blocked-list";
import { TopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Usuarios bloqueados" };

// Usuarios bloqueados (T-10.2.1, US-049, pantalla 17). Solo el dueño: el proxy y requireOwner
// mandan al profesional al inicio, y client_stats no le responde.
export default async function BlockedClientsPage() {
  const owner = await requireOwner("/pro/configurar/bloqueados");
  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title="Usuarios bloqueados" backHref="/pro/configurar" />
      <main className="mx-auto flex max-w-[720px] flex-col gap-4 pb-28 pt-5">
        <p className="px-5 text-14 text-slate md:px-6">
          No pueden reservar en línea en tu negocio. Las citas que ya tienen
          agendadas siguen. Desbloquéalos cuando quieras.
        </p>
        <BlockedList businessId={owner.business.id} />
      </main>
    </div>
  );
}
