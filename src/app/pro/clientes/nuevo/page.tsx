import type { Metadata } from "next";
import { requireOwner } from "@/features/business/services/queries";
import { ClientEditorPage } from "@/features/clients/components/client-editor-page";

export const metadata: Metadata = { title: "Crear cliente" };

// Crear un cliente desde Clientes (T-10.1.3, US-048). Solo el dueño; el profesional sigue
// creando clientes rápidos desde la agenda, si tiene el permiso.
export default async function NewClientPage() {
  await requireOwner("/pro/clientes/nuevo");
  return <ClientEditorPage client={null} />;
}
