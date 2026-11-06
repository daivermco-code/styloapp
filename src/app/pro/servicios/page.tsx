import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { requireOwner } from "@/features/business/services/queries";
import { ServiceList } from "@/features/catalog/components/service-list";
import { getCatalog } from "@/features/catalog/services/queries";
import { EmptyState } from "@/shared/components/empty-state";
import { Fab } from "@/shared/components/fab";
import { PillTabs } from "@/shared/components/pill-tabs";
import { TopBar } from "@/shared/components/top-bar";
import { PendingArea } from "@/shared/components/instant-nav";
import { RowsSkeleton } from "@/shared/components/page-skeleton";
import { NAV_GROUP } from "@/shared/lib/instant-nav";

export const metadata: Metadata = { title: "Servicios" };

const ARCHIVED = "archivados";

// Servicios del negocio (T-2.3.1, US-011, captura 30): pestañas Activos y Archivados en la URL
// (?pestana=archivados), para que se puedan recargar y compartir.
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ pestana?: string }>;
}) {
  const owner = await requireOwner("/pro/servicios");
  const { pestana } = await searchParams;
  const active = pestana !== ARCHIVED;
  const categories = await getCatalog(owner.business.id);
  const count = (isActive: boolean) =>
    categories
      .flatMap((category) => category.services)
      .filter((service) => service.isActive === isActive).length;
  const tabs = [
    {
      label: "Activos",
      href: "/pro/servicios",
      selected: active,
      total: count(true),
    },
    {
      label: "Archivados",
      href: `/pro/servicios?pestana=${ARCHIVED}`,
      selected: !active,
      total: count(false),
    },
  ];
  const shown = active ? tabs[0].total : tabs[1].total;

  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title="Servicios" backHref="/pro" />
      <main className="mx-auto flex max-w-[720px] flex-col gap-4 px-5 pb-28 pt-4 md:px-6">
        <PillTabs label="Servicios activos o archivados" tabs={tabs} />

        <PendingArea groups={[NAV_GROUP.tabs]} fallback={<RowsSkeleton />}>
          {shown > 0 ? (
            <ServiceList categories={categories} active={active} />
          ) : (
            <EmptyState
              message={
                active
                  ? categories.length === 0
                    ? "Todavía no tienes servicios. Crea el primero con su categoría."
                    : "No tienes servicios activos. Crea uno o activa uno archivado."
                  : "No tienes servicios archivados."
              }
            />
          )}
        </PendingArea>
      </main>
      <Fab
        href="/pro/servicios/nuevo"
        label="Crear servicio"
        icon={<Plus />}
        extended
      />
    </div>
  );
}
