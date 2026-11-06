import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAgendaViewer } from "@/features/agenda/services/queries";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { InvoiceEditorScreen } from "@/features/invoices/components/invoice-editor-screen";
import {
  getBookingSeed,
  type SeedResult,
} from "@/features/invoices/services/editor-queries";
import { getInvoiceViewer } from "@/features/invoices/services/queries";
import type { InvoiceViewer } from "@/features/invoices/types/invoice";
import { NO_INVOICING_PERMISSION } from "@/features/invoices/types/messages";

export const metadata: Metadata = { title: "Crear factura" };

const bookingId = z.uuid();

const EMPTY_SEED: SeedResult = {
  ok: true,
  seed: {
    invoiceId: null,
    bookingId: null,
    bookingStartsAt: null,
    client: null,
    guestName: "",
    items: [],
    methodId: null,
  },
};

/** Con qué abre: vacío, o la cita de ?cita= (US-041) ya puesta en el paso 3. */
async function seedFor(
  viewer: InvoiceViewer,
  cita: string | undefined,
): Promise<SeedResult> {
  if (!viewer.canInvoice) {
    return { ok: false, message: NO_INVOICING_PERMISSION };
  }
  if (cita === undefined) return EMPTY_SEED;
  if (!bookingId.safeParse(cita).success) {
    return { ok: false, message: "Esta cita ya no existe." };
  }
  return getBookingSeed(viewer, cita);
}

/** Salir vuelve a la cita (la agenda la abre en su día) si viene de una; si no, a Facturas. */
function exitHrefFor(cita: string | undefined): string {
  return cita !== undefined && bookingId.safeParse(cita).success
    ? `/pro/agenda?cita=${cita}`
    : "/pro/facturas";
}

// Crear una factura (T-8.3.1 y T-8.3.2, US-040; con ?cita=<id>, US-041). Sin el permiso de
// facturación, el profesional ve el aviso; la base lo repite en save_invoice.
export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ cita?: string }>;
}) {
  const { cita } = await searchParams;
  const person = await getCurrentPerson();
  if (!person) {
    const back = cita
      ? `/pro/facturas/nueva?cita=${cita}`
      : "/pro/facturas/nueva";
    redirect(`/entrar?siguiente=${encodeURIComponent(back)}`);
  }
  const [viewer, agendaViewer] = await Promise.all([
    getInvoiceViewer(person),
    getAgendaViewer(person),
  ]);
  // El proxy solo deja entrar a /pro a quien tiene una fila activa en staff (invariante 1).
  if (!viewer) redirect("/pro");

  const result = await seedFor(viewer, cita);
  return (
    <InvoiceEditorScreen
      viewer={viewer}
      result={result}
      blockedTitle="Crear factura"
      exitHref={exitHrefFor(cita)}
      canCreateClients={agendaViewer?.canCreateClients ?? false}
    />
  );
}
