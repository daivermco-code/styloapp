"use client";

import { ChevronRight, LoaderCircle, Receipt, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PUNCTUALITY } from "@/features/reviews/types/schemas";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { invoiceTitle } from "../lib/totals";
import { quickInvoice } from "../services/actions";
import { ALREADY_INVOICED, MARK_BEFORE_INVOICING } from "../types/messages";

interface BookingInvoiceActionsProps {
  bookingId: string;
  /** La llegada marcada: 5 a tiempo, 3 tarde, 1 no llegó; null sin marcar. */
  punctuality: number | null;
  /** Su factura pagada, si ya la tiene. */
  invoice: { id: string; number: number } | null;
  /** Tiene factura pagada, la vea o no quien mira (booking_is_invoiced). */
  invoiced: boolean;
  canInvoice: boolean;
}

/** "Factura rápida": la crea de una vez y la cita pasa a "Ver factura". */
function useQuickInvoice(bookingId: string) {
  const router = useRouter();
  const [pending, startTransition] = useActionTransition();
  const create = () => {
    startTransition(async () => {
      const result = await quickInvoice({ bookingId });
      if (result.ok) toast.success(result.data.message);
      else toast.error(result.error.message);
      router.refresh();
    });
  };
  return { create, pending };
}

/** Los dos botones del mismo ancho; mientras se crea la rápida, los dos se apagan. */
function InvoiceButtons({ bookingId }: { bookingId: string }) {
  const hydrated = useHydrated();
  const { create, pending } = useQuickInvoice(bookingId);
  return (
    // Celular primero: uno debajo del otro a todo el ancho; desde sm, lado a lado.
    <div className="grid gap-3 sm:grid-cols-2">
      {pending ? (
        <Button type="button" disabled className="min-w-0">
          <Receipt />
          Generar factura
        </Button>
      ) : (
        <Button asChild className="min-w-0">
          <Link href={`/pro/facturas/nueva?cita=${bookingId}`}>
            <Receipt />
            Generar factura
          </Link>
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={create}
        disabled={!hydrated || pending}
        className="min-w-0"
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <Zap />}
        Factura rápida
      </Button>
    </div>
  );
}

// Los botones de factura en el detalle de la cita (T-8.4.1, US-041, pantalla 10), debajo de la
// llegada. Marcada "A tiempo" o "Tarde": "Generar factura" (abre el editor en el paso 3 con todo
// puesto) y "Factura rápida". Ya facturada: "Ver factura 0012", o el aviso si quien mira no la ve
// (el dueño la facturó solo con servicios de otro). Sin marcar: la línea de aviso. Si no llegó, o
// al profesional sin el permiso, nada. La base lo repite en save_invoice.
export function BookingInvoiceActions({
  bookingId,
  punctuality,
  invoice,
  invoiced,
  canInvoice,
}: BookingInvoiceActionsProps) {
  if (invoice) {
    return (
      <Link
        href={`/pro/facturas/${invoice.id}`}
        className="mx-auto inline-flex min-h-11 items-center gap-1 rounded-card px-2 text-16 font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Ver {invoiceTitle(invoice.number).toLowerCase()}
        <ChevronRight className="size-5" aria-hidden />
      </Link>
    );
  }
  if (invoiced) {
    return <p className="text-center text-14 text-slate">{ALREADY_INVOICED}</p>;
  }
  if (!canInvoice || punctuality === PUNCTUALITY.noShow) return null;
  if (punctuality !== PUNCTUALITY.onTime && punctuality !== PUNCTUALITY.late) {
    return (
      <p className="text-center text-14 text-slate">{MARK_BEFORE_INVOICING}</p>
    );
  }
  return <InvoiceButtons bookingId={bookingId} />;
}
