"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import {
  type BusinessFunctions,
  CANCEL_LIMIT_OPTIONS,
  cancelLimitLabel,
  MAX_ADVANCE_OPTIONS,
  maxAdvanceLabel,
  MIN_NOTICE_OPTIONS,
  minNoticeLabel,
  ONLINE_BOOKING_OFF,
  SLOT_INTERVAL_OPTIONS,
  type SlotInterval,
  slotIntervalLabel,
} from "../lib/functions";
import { updateBusinessFunctions } from "../services/actions";

const NO_LIMIT = "sin-limite";

interface FieldRowProps {
  id: string;
  label: string;
  hint: ReactNode;
  children: ReactNode;
}

// Fila título–explicación–control, como en la captura 65.
function FieldRow({ id, label, hint, children }: FieldRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-5">
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={id} className="text-18 text-ink">
          {label}
        </label>
        <p id={`${id}-hint`} className="text-14 text-slate">
          {hint}
        </p>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

interface NumberSelectProps<T extends number | null> {
  id: string;
  value: T;
  options: readonly T[];
  label: (value: T) => string;
  onChange: (value: T) => void;
}

function NumberSelect<T extends number | null>({
  id,
  value,
  options,
  label,
  onChange,
}: NumberSelectProps<T>) {
  const toKey = (option: T) => (option === null ? NO_LIMIT : String(option));
  return (
    <Select
      value={toKey(value)}
      onValueChange={(key) =>
        onChange(options.find((option) => toKey(option) === key) as T)
      }
    >
      <SelectTrigger
        id={id}
        aria-describedby={`${id}-hint`}
        className="w-[150px]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={toKey(option)} value={toKey(option)}>
            {label(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Funciones adicionales del negocio (US-010, captura 65): se guardan todas con "Guardar" y se ven
// al recargar. Si no se guarda, lo elegido se queda en el formulario.
export function BusinessFunctionsForm({
  initial,
}: {
  initial: BusinessFunctions;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useActionTransition();
  const dirty = (Object.keys(initial) as (keyof BusinessFunctions)[]).some(
    (key) => values[key] !== initial[key],
  );

  const set = <K extends keyof BusinessFunctions>(
    key: K,
    value: BusinessFunctions[K],
  ) => setValues((current) => ({ ...current, [key]: value }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateBusinessFunctions(values);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      toast.success("Cambios guardados");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      <div className="divide-y divide-line">
        <FieldRow
          id="cancelLimit"
          label="Cancelación de citas"
          hint="Hasta cuánto antes de la hora de la cita puede cancelar un cliente."
        >
          <NumberSelect
            id="cancelLimit"
            value={values.cancelLimitMinutes}
            options={CANCEL_LIMIT_OPTIONS}
            label={cancelLimitLabel}
            onChange={(value) => set("cancelLimitMinutes", value)}
          />
        </FieldRow>
        <FieldRow
          id="slotInterval"
          label="Intervalo de las horas"
          hint="Cada cuánto salen las horas al reservar (lo recomendado es 30 min). Con 30 min, el cliente ve 7:30, 8:00, 8:30…"
        >
          <NumberSelect<SlotInterval>
            id="slotInterval"
            value={values.slotIntervalMinutes}
            options={SLOT_INTERVAL_OPTIONS}
            label={slotIntervalLabel}
            onChange={(value) => set("slotIntervalMinutes", value)}
          />
        </FieldRow>
        <FieldRow
          id="onlineBooking"
          label="Reservas en línea"
          hint={
            values.onlineBooking
              ? "Los clientes reservan desde la app y desde el enlace del negocio."
              : `Apagadas, los clientes ven el negocio con este aviso: «${ONLINE_BOOKING_OFF}»`
          }
        >
          <Switch
            id="onlineBooking"
            checked={values.onlineBooking}
            onCheckedChange={(checked) => set("onlineBooking", checked)}
            aria-describedby="onlineBooking-hint"
          />
        </FieldRow>
        <FieldRow
          id="showOwnerAgenda"
          label="Agenda del dueño"
          hint="Los clientes pueden elegirte como profesional al reservar."
        >
          <Switch
            id="showOwnerAgenda"
            checked={values.showOwnerAgenda}
            onCheckedChange={(checked) => set("showOwnerAgenda", checked)}
            aria-describedby="showOwnerAgenda-hint"
          />
        </FieldRow>
        <FieldRow
          id="minNotice"
          label="Antelación mínima"
          hint="Con 15 min, nadie puede reservar una hora que empieza en menos de 15 minutos."
        >
          <NumberSelect
            id="minNotice"
            value={values.minNoticeMinutes}
            options={MIN_NOTICE_OPTIONS}
            label={minNoticeLabel}
            onChange={(value) => set("minNoticeMinutes", value)}
          />
        </FieldRow>
        <FieldRow
          id="maxAdvance"
          label="Anticipación máxima"
          hint="Con 3 días, los clientes solo reservan dentro de los próximos 3 días."
        >
          <NumberSelect
            id="maxAdvance"
            value={values.maxAdvanceDays}
            options={MAX_ADVANCE_OPTIONS}
            label={maxAdvanceLabel}
            onChange={(value) => set("maxAdvanceDays", value)}
          />
        </FieldRow>
      </div>

      {error && (
        <p role="alert" className="pt-2 text-14 text-danger">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={!hydrated || !dirty || pending}
        className="mt-6 w-full self-center md:w-[320px]"
      >
        {pending && <LoaderCircle className="animate-spin" />}
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
