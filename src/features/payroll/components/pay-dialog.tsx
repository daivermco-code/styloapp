"use client";

import { CircleCheck, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentMethod } from "@/features/business/types/payment";
import { FieldBox } from "@/shared/components/field-box";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { formatCOP } from "@/shared/lib/money";
import { type ActionError, AppErrorCode } from "@/shared/types/action-result";
import { payStaff } from "../services/actions";
import { payStaffSchema } from "../types/schemas";

interface PayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string;
  staffName: string;
  /** Lo que se ve ahora: solo para leer, la base lo vuelve a sumar. */
  total: number;
  /** Los métodos activos del negocio; el primero va puesto. */
  methods: PaymentMethod[];
  /** Hoy en Bogotá ("YYYY-MM-DD"). */
  today: string;
}

type Field = "paymentMethodId" | "paidOn" | "note";

const NOTE_CLASS =
  "min-h-20 w-full resize-y rounded-card border border-input bg-surface px-4 py-3 text-16 text-ink placeholder:text-slate focus-visible:border-2 focus-visible:border-primary focus-visible:px-[15px] focus-visible:py-[11px] focus-visible:outline-none";

/** Lo que dice el aviso al pagar: el valor guardado, o sin cifra si no se alcanzó a leer. */
function paidMessage(amount: number | null, staffName: string): string {
  return amount === null
    ? `Le pagaste a ${staffName}. Míralo en el Historial de pagos.`
    : `Le pagaste ${formatCOP(amount)} a ${staffName}.`;
}

/** Los atributos de error de un control: aria-invalid y aria-describedby si hay error. */
function errorProps(id: string, error: string | undefined) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  };
}

function MethodSelect({
  methods,
  value,
  onChange,
  error,
}: {
  methods: PaymentMethod[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id="pay-method" {...errorProps("pay-method", error)}>
        <SelectValue placeholder="Elige un método">
          {methods.find((method) => method.id === value)?.name}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {methods.map((method) => (
          <SelectItem key={method.id} value={method.id}>
            {method.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** El pago: lo valida con el mismo esquema del servidor y avisa cómo terminó. */
function usePayForm(props: PayDialogProps) {
  const { staffId, staffName, methods, today, onOpenChange } = props;
  const router = useRouter();
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useActionTransition();

  const check = payStaffSchema(today).safeParse({
    staffId,
    paymentMethodId: methodId || undefined,
    paidOn: paidOn || undefined,
    note,
  });
  const issueOf = (field: Field) =>
    (error?.field === field ? error.message : undefined) ??
    (check.success
      ? undefined
      : check.error.issues.find((issue) => issue.path[0] === field)?.message);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!check.success) return;
    startTransition(async () => {
      const result = await payStaff(check.data);
      if (result.ok) {
        toast.success(paidMessage(result.data.amount, staffName));
        onOpenChange(false);
        router.replace("/pro/liquidador", { scroll: false });
        return;
      }
      // Ya no hay nada que pagar o faltan citas: la ventana se cierra y la hoja dice cómo quedó.
      const stale =
        result.error.code === AppErrorCode.NOTHING_PENDING ||
        result.error.code === AppErrorCode.UNMARKED_BOOKINGS;
      if (!stale) {
        setError(result.error);
        return;
      }
      toast.error(result.error.message);
      onOpenChange(false);
      router.refresh();
    });
  };

  const edit = (apply: () => void) => {
    apply();
    setError(null);
  };
  return {
    values: { methodId, paidOn, note },
    setMethodId: (value: string) => edit(() => setMethodId(value)),
    setPaidOn: (value: string) => edit(() => setPaidOn(value)),
    setNote: (value: string) => edit(() => setNote(value)),
    issueOf,
    formError: error && !error.field ? error.message : undefined,
    canSubmit: check.success && !pending,
    pending,
    submit,
  };
}

type PayForm = ReturnType<typeof usePayForm>;

/** Método, fecha y nota, cada uno con su error debajo. */
function PayFields({
  form,
  methods,
  today,
}: {
  form: PayForm;
  methods: PaymentMethod[];
  today: string;
}) {
  const methodError = form.issueOf("paymentMethodId");
  const dateError = form.issueOf("paidOn");
  const noteError = form.issueOf("note");
  return (
    <>
      <FieldBox
        id="pay-method"
        label="Método de pago"
        required
        error={methodError}
      >
        <MethodSelect
          methods={methods}
          value={form.values.methodId}
          onChange={form.setMethodId}
          error={methodError}
        />
      </FieldBox>
      <FieldBox id="pay-date" label="Fecha" required error={dateError}>
        <Input
          id="pay-date"
          type="date"
          max={today}
          value={form.values.paidOn}
          onChange={(event) => form.setPaidOn(event.target.value)}
          {...errorProps("pay-date", dateError)}
        />
      </FieldBox>
      <FieldBox id="pay-note" label="Nota" error={noteError}>
        <textarea
          id="pay-note"
          value={form.values.note}
          onChange={(event) => form.setNote(event.target.value)}
          maxLength={200}
          rows={2}
          placeholder="Ej. Quincena de noviembre"
          className={NOTE_CLASS}
          {...errorProps("pay-note", noteError)}
        />
      </FieldBox>
    </>
  );
}

// "Pagar" (T-9.2.2, US-045, pantalla 12): ventana centrada con el valor (para leer), el método, la
// fecha (hoy) y una nota opcional. Al confirmar avisa con el valor que de verdad se pagó y vuelve
// a la lista, donde el profesional queda en $ 0. La hoja la monta de nuevo cada vez que se abre,
// así que no guarda errores ni lo escrito de una vez anterior.
export function PayDialog(props: PayDialogProps) {
  const { open, onOpenChange, staffName, total, methods, today } = props;
  const form = usePayForm(props);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !form.pending && onOpenChange(next)}
    >
      <DialogContent className="max-h-[90dvh] gap-5 overflow-y-auto px-5 pb-6 pt-10">
        <div className="flex flex-col gap-1">
          <DialogTitle className="text-18 font-bold text-ink">
            Pagarle a {staffName}
          </DialogTitle>
          <DialogDescription className="text-14 text-slate">
            Todas sus comisiones pendientes. El valor sale de la suma: no se
            escribe.
          </DialogDescription>
        </div>
        <form onSubmit={form.submit} noValidate className="flex flex-col gap-5">
          <dl className="flex flex-col gap-1">
            <dt className="text-14 font-bold text-ink">Valor del pago</dt>
            <dd className="text-22 font-bold text-primary">
              {formatCOP(total)}
            </dd>
          </dl>
          <PayFields form={form} methods={methods} today={today} />
          {form.formError && (
            <p role="alert" className="text-14 text-danger">
              {form.formError}
            </p>
          )}
          <Button type="submit" disabled={!form.canSubmit}>
            {form.pending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <CircleCheck />
            )}
            {form.pending ? "Pagando…" : "Confirmar pago"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
