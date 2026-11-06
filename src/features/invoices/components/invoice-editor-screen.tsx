import { SquarePen, Tag } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { getBusinessClients } from "@/features/agenda/services/queries";
import { EmptyState } from "@/shared/components/empty-state";
import { TopBar } from "@/shared/components/top-bar";
import { todayInBogota } from "@/shared/lib/dates";
import { periodRange } from "@/shared/lib/periods";
import { parseInvoiceView } from "../lib/filters";
import { withSeedServices } from "../lib/draft";
import {
  getInvoiceCatalog,
  getInvoiceCommissions,
  getInvoiceMethods,
  type SeedResult,
} from "../services/editor-queries";
import type { InvoiceSeed, InvoiceViewer } from "../types/invoice";
import { InvoiceEditor } from "./invoice-editor";
import { InvoiceList, InvoiceListSkeleton } from "./invoice-list";

/** En computador, a la izquierda y sin tocarse: las facturas de hoy, como en Facturas. */
function TodayInvoices({ viewer }: { viewer: InvoiceViewer }) {
  const view = parseInvoiceView({}, todayInBogota());
  return (
    // inert: un toque ahí no se lleva el borrador sin preguntar.
    <div
      inert
      className="hidden h-dvh min-h-0 flex-col overflow-y-auto bg-surface lg:flex"
    >
      <header className="flex min-h-14 items-center gap-2 px-5 shadow-card">
        <Tag className="size-6 text-primary" aria-hidden />
        <h2 className="text-18 font-bold text-primary">Facturas de hoy</h2>
      </header>
      <Suspense fallback={<InvoiceListSkeleton liftsInbox={false} />}>
        <InvoiceList
          viewer={viewer}
          view={view}
          range={periodRange(view.period, view.day)}
          staffId={viewer.side === "owner" ? null : viewer.staffId}
          liftsInbox={false}
        />
      </Suspense>
    </div>
  );
}

/** El borrador listo para abrir: el catálogo con lo que trae, los métodos y la comisión. */
async function loadEditor(viewer: InvoiceViewer, seed: InvoiceSeed) {
  const [catalog, clients, methods] = await Promise.all([
    getInvoiceCatalog(viewer),
    getBusinessClients(viewer.businessId),
    getInvoiceMethods(viewer.businessId, seed.methodId),
  ]);
  const categories = withSeedServices(
    catalog,
    seed.items.flatMap((item) =>
      item.price === null ? [] : [{ ...item, price: item.price }],
    ),
  );
  const commissions = await getInvoiceCommissions(viewer, categories);
  // Al crear, el primer método activo ya va puesto (se puede cambiar en el paso 3).
  const methodId = seed.methodId ?? methods[0]?.id ?? null;
  return { categories, clients, methods, commissions, methodId };
}

interface InvoiceEditorScreenProps {
  viewer: InvoiceViewer;
  /** Con qué abre: un borrador, o por qué no se puede (sin permiso, cita sin marcar…). */
  result: SeedResult;
  /** La barra cuando no se puede abrir. */
  blockedTitle: string;
  exitHref: string;
  /** El profesional del negocio puede crear fichas de clientes (internal_clients). */
  canCreateClients: boolean;
}

// La pantalla del editor de factura (T-8.3.1 y T-8.3.2, pantalla 8), para /nueva y /editar. En el
// celular ocupa la pantalla; en computador, como el editor de reservas, las facturas de hoy quedan
// a la izquierda y los tres pasos en el panel de la derecha.
export async function InvoiceEditorScreen({
  viewer,
  result,
  blockedTitle,
  exitHref,
  canCreateClients,
}: InvoiceEditorScreenProps) {
  if (!result.ok) {
    return (
      <div className="min-h-dvh bg-surface">
        <TopBar title={blockedTitle} icon={<SquarePen />} backHref={exitHref} />
        <EmptyState
          message={result.message}
          action={
            result.invoiceId ? (
              <Button asChild variant="outline">
                <Link href={`/pro/facturas/${result.invoiceId}`}>
                  Ver factura
                </Link>
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  const { categories, clients, methods, commissions, methodId } =
    await loadEditor(viewer, result.seed);
  return (
    <div className="h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_440px]">
      <TodayInvoices viewer={viewer} />
      <div className="h-dvh overflow-y-auto bg-surface lg:border-l lg:border-line">
        <InvoiceEditor
          seed={{ ...result.seed, methodId }}
          categories={categories}
          clients={clients}
          canCreateClients={canCreateClients}
          canPickStaff={viewer.side === "owner"}
          methods={methods}
          commissions={commissions}
          exitHref={exitHref}
        />
      </div>
    </div>
  );
}
