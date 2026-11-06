import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/features/business/services/queries";
import { ServiceForm } from "@/features/catalog/components/service-form";
import { ServiceStateButton } from "@/features/catalog/components/service-state-button";
import { getCatalog, getService } from "@/features/catalog/services/queries";
import { TopBar } from "@/shared/components/top-bar";

const NEW = "nuevo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: id === NEW ? "Nuevo servicio" : "Editar servicio" };
}

// Editor de servicio (T-2.3.2): /pro/servicios/nuevo crea; /pro/servicios/[id] edita, archiva o
// vuelve a activar.
export default async function ServiceEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === NEW;
  if (!isNew && !z.uuid().safeParse(id).success) notFound();
  const owner = await requireOwner(`/pro/servicios/${id}`);
  const [catalog, service] = await Promise.all([
    getCatalog(owner.business.id),
    isNew ? null : getService(owner.business.id, id),
  ]);
  if (!isNew && !service) notFound();
  const categories = catalog.map(({ id: categoryId, name }) => ({
    id: categoryId,
    name,
  }));
  const back =
    service && !service.isActive
      ? "/pro/servicios?pestana=archivados"
      : "/pro/servicios";

  return (
    <div className="min-h-dvh bg-surface">
      <TopBar
        title={isNew ? "Nuevo servicio" : "Editar servicio"}
        backHref={back}
      />
      <main className="mx-auto flex max-w-[720px] flex-col gap-8 px-5 pb-24 pt-6 md:px-6">
        {service && !service.isActive && (
          <p className="rounded-card bg-soft px-4 py-3 text-14 text-ink">
            Este servicio está archivado: no sale en la app de clientes ni en el
            editor de reservas.
          </p>
        )}
        <ServiceForm service={service} categories={categories} />
        {service && (
          <div className="flex justify-center border-t border-line pt-6">
            <ServiceStateButton
              id={service.id}
              name={service.name}
              active={service.isActive}
              layout="inline"
              then={
                service.isActive
                  ? "/pro/servicios?pestana=archivados"
                  : "/pro/servicios"
              }
            />
          </div>
        )}
      </main>
    </div>
  );
}
