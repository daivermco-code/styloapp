"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { formatCOP } from "@/shared/lib/money";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import type { ActionError } from "@/shared/types/action-result";
import { bookingLabel } from "../lib/detail";
import { draftTotals } from "../lib/draft";
import { invoiceTitle } from "../lib/totals";
import { saveInvoice } from "../services/actions";
import { useInvoiceDraft } from "../store/invoice-draft";
import type { InvoiceMethodOption } from "../types/invoice";
import { NO_CLIENT } from "../types/messages";

interface InvoicePaymentStepProps {
  invoiceId: string | null;
  bookingId: string | null;
  bookingStartsAt: string | null;
  methods: InvoiceMethodOption[];
  /** La comisión por profesional y servicio; null si quien mira no la puede leer. */
  commissions: Record<string, number> | null;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 text-16">
      <span className="text-slate">{label}</span>
      <span className="min-w-0 text-right text-ink">{value}</span>
    </div>
  );
}

/** Sin ficha: el nombre libre opcional, como la hoja de la reserva lo pide al final. */
function GuestNameField({ error }: { error: ActionError | null }) {
  const hydrated = useHydrated();
  const guestName = useInvoiceDraft((state) => state.guestName);
  const setGuestName = useInvoiceDraft((state) => state.setGuestName);
  const invalid = error?.field === "guestName";
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="facturaNombre" className="text-14 font-bold text-ink">
        Nombre del cliente (opcional)
      </label>
      <Input
        id="facturaNombre"
        value={guestName}
        maxLength={80}
        autoComplete="off"
        disabled={!hydrated}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? "facturaNombreError" : undefined}
        onChange={(event) => setGuestName(event.target.value)}
      />
      {invalid && (
        <p id="facturaNombreError" className="text-14 text-danger">
          {error.message}
        </p>
      )}
    </div>
  );
}

function MethodField({ methods }: { methods: InvoiceMethodOption[] }) {
  const hydrated = useHydrated();
  const methodId = useInvoiceDraft((state) => state.methodId);
  const setMethod = useInvoiceDraft((state) => state.setMethod);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="facturaMetodo" className="text-14 font-bold text-ink">
        Método de pago <span aria-hidden="true">*</span>
      </label>
      <Select
        value={methodId ?? undefined}
        onValueChange={setMethod}
        disabled={!hydrated}
      >
        <SelectTrigger id="facturaMetodo" className="h-12">
          <SelectValue placeholder="Elige el método" />
        </SelectTrigger>
        <SelectContent>
          {methods.map((method) => (
            <SelectItem key={method.id} value={method.id}>
              {method.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Guarda el borrador con saveInvoice y lleva al detalle de la factura. */
function useSaveDraft(invoiceId: string | null, bookingId: string | null) {
  const router = useRouter();
  const draft = useInvoiceDraft((state) => state);
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useActionTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const guestName = draft.guestName.trim();
      const result = await saveInvoice({
        invoiceId: invoiceId ?? undefined,
        bookingId: bookingId ?? undefined,
        clientId: draft.client?.kind === "client" ? draft.client.id : undefined,
        guestName:
          draft.client?.kind === "client" || guestName === ""
            ? undefined
            : guestName,
        paymentMethodId: draft.methodId ?? "",
        items: draft.items.map((item) => ({
          serviceId: item.serviceId,
          staffId: item.staffId,
          price: item.price ?? Number.NaN,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error.message);
        return;
      }
      const title = invoiceTitle(result.data.number);
      toast.success(invoiceId ? `${title} actualizada.` : `${title} creada.`);
      router.push(`/pro/facturas/${result.data.invoiceId}`);
    });
  };
  return { save, error, pending };
}

// Paso 3 del editor (T-8.3.2, US-040, US-041 y US-043, pantalla 8): el resumen con el total, la
// comisión del equipo (solo el dueño: al profesional la base no le deja leer el porcentaje antes
// de facturar), el método de pago activo y "Crear factura" o "Guardar cambios".
export function InvoicePaymentStep({
  invoiceId,
  bookingId,
  bookingStartsAt,
  methods,
  commissions,
}: InvoicePaymentStepProps) {
  const hydrated = useHydrated();
  const client = useInvoiceDraft((state) => state.client);
  const guestName = useInvoiceDraft((state) => state.guestName);
  const items = useInvoiceDraft((state) => state.items);
  const { save, error, pending } = useSaveDraft(invoiceId, bookingId);
  const { total, commission } = draftTotals(items, commissions);

  return (
    <div className="flex flex-col gap-5 px-5 pb-10 pt-4">
      <section className="flex flex-col border-b border-line pb-3">
        <SummaryRow
          label="Cliente"
          value={
            client?.kind === "client"
              ? client.fullName
              : guestName.trim() || NO_CLIENT
          }
        />
        {bookingStartsAt && (
          <SummaryRow label="Cita" value={bookingLabel(bookingStartsAt)} />
        )}
      </section>
      {client?.kind !== "client" && <GuestNameField error={error} />}

      <ul className="flex flex-col border-b border-line pb-3">
        {items.map((item) => (
          <li
            key={item.serviceId}
            className="flex min-h-11 items-center justify-between gap-4 text-16 text-ink"
          >
            <span className="min-w-0">
              {item.serviceName} · {item.staffName}
            </span>
            <span className="shrink-0">{formatCOP(item.price ?? 0)}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1">
        <p className="flex items-center justify-between gap-4 text-22 font-bold text-primary">
          <span>Total</span>
          <span>{formatCOP(total)}</span>
        </p>
        {commission !== null && (
          <p className="flex items-center justify-between gap-4 text-14 text-slate">
            <span>Comisión del equipo</span>
            <span>{formatCOP(commission)}</span>
          </p>
        )}
      </div>

      <MethodField methods={methods} />

      <Button
        type="button"
        onClick={save}
        disabled={!hydrated || pending}
        className="self-center"
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <Check />}
        {invoiceId ? "Guardar cambios" : "Crear factura"}
      </Button>
    </div>
  );
}
