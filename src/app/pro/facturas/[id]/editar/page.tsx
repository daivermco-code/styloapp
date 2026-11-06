import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAgendaViewer } from "@/features/agenda/services/queries";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { InvoiceEditorScreen } from "@/features/invoices/components/invoice-editor-screen";
import {
  getInvoiceSeed,
  type SeedResult,
} from "@/features/invoices/services/editor-queries";
import { getInvoiceViewer } from "@/features/invoices/services/queries";
import type { InvoiceViewer } from "@/features/invoices/types/invoice";
import {
  INVOICE_GONE,
  NO_INVOICING_PERMISSION,
} from "@/features/invoices/types/messages";

export const metadata: Metadata = { title: "Editar factura" };

const invoiceId = z.uuid();

/** La factura en el borrador, o por qué no se puede editar (US-043). */
async function seedFor(viewer: InvoiceViewer, id: string): Promise<SeedResult> {
  if (!viewer.canInvoice) {
    return { ok: false, message: NO_INVOICING_PERMISSION };
  }
  if (!invoiceId.safeParse(id).success) {
    return { ok: false, message: INVOICE_GONE };
  }
  return getInvoiceSeed(viewer, id);
}

// Editar una factura (T-8.3.2, US-043): el mismo editor, que entra al paso 3 con todo puesto y
// guarda con "Guardar cambios". Anulada, ya pagada al profesional o, para el profesional, con
// servicios de otro, dice por qué no; la base lo repite en save_invoice.
export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const person = await getCurrentPerson();
  if (!person) {
    redirect(
      `/entrar?siguiente=${encodeURIComponent(`/pro/facturas/${id}/editar`)}`,
    );
  }
  const [viewer, agendaViewer] = await Promise.all([
    getInvoiceViewer(person),
    getAgendaViewer(person),
  ]);
  // El proxy solo deja entrar a /pro a quien tiene una fila activa en staff (invariante 1).
  if (!viewer) redirect("/pro");

  const result = await seedFor(viewer, id);
  const valid = invoiceId.safeParse(id).success;
  return (
    <InvoiceEditorScreen
      viewer={viewer}
      result={result}
      blockedTitle="Editar factura"
      exitHref={valid ? `/pro/facturas/${id}` : "/pro/facturas"}
      canCreateClients={agendaViewer?.canCreateClients ?? false}
    />
  );
}
