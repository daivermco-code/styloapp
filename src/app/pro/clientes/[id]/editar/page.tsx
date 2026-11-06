import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/features/business/services/queries";
import { ClientEditorPage } from "@/features/clients/components/client-editor-page";
import { getClientProfile } from "@/features/clients/services/queries";

export const metadata: Metadata = { title: "Editar cliente" };

// Editar la ficha de un cliente (T-10.1.3, US-048). Solo el dueño.
export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const owner = await requireOwner(`/pro/clientes/${id}/editar`);
  const client = await getClientProfile(owner.business.id, id);
  if (!client) notFound();
  return <ClientEditorPage client={client} />;
}
