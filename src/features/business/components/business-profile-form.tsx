"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { updateBusinessProfile } from "../services/actions";
import type { BusinessProfileInput } from "../types/schemas";

type Field = keyof BusinessProfileInput;

interface TextFieldProps {
  id: Field;
  /** Antes de React no se escribe: lo escrito se perdería al tomar la página. */
  ready: boolean;
  label: string;
  required?: boolean;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  maxLength: number;
  prefix?: string;
  inputMode?: "numeric";
  placeholder?: string;
}

function TextField({
  id,
  ready,
  label,
  required = false,
  value,
  error,
  onChange,
  autoComplete,
  maxLength,
  prefix,
  inputMode,
  placeholder,
}: TextFieldProps) {
  const input = (
    <Input
      id={id}
      name={id}
      value={value}
      readOnly={!ready}
      onChange={(event) => onChange(event.target.value)}
      autoComplete={autoComplete}
      maxLength={maxLength}
      inputMode={inputMode}
      type={inputMode ? "tel" : "text"}
      placeholder={placeholder}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={prefix ? "pl-14 focus-visible:pl-[55px]" : undefined}
    />
  );
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-14 font-bold text-ink">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {prefix ? (
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-16 font-bold text-ink">
            {prefix}
          </span>
          {input}
        </div>
      ) : (
        input
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-14 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

// Datos del negocio (US-008). Si no se guarda, lo escrito se queda en el formulario.
export function BusinessProfileForm({
  initial,
}: {
  initial: BusinessProfileInput;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useActionTransition();

  const set = (field: Field) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateBusinessProfile(values);
      if (!result.ok) {
        const { field, message } = result.error;
        if (field && field in initial) {
          setErrors({ [field]: message });
          setFormError(null);
          document.getElementById(field)?.focus();
        } else {
          setErrors({});
          setFormError(message);
        }
        return;
      }
      setErrors({});
      setFormError(null);
      toast.success("Cambios guardados");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <p className="text-14 text-slate">Los campos con * son obligatorios.</p>
      <TextField
        ready={hydrated}
        id="name"
        label="Nombre del negocio"
        required
        value={values.name}
        error={errors.name}
        onChange={set("name")}
        autoComplete="organization"
        maxLength={60}
      />
      <TextField
        ready={hydrated}
        id="address"
        label="Dirección"
        required
        value={values.address}
        error={errors.address}
        onChange={set("address")}
        autoComplete="street-address"
        maxLength={120}
        placeholder="Calle 57 # 9-23"
      />
      <TextField
        ready={hydrated}
        id="neighborhood"
        label="Barrio"
        value={values.neighborhood}
        error={errors.neighborhood}
        onChange={set("neighborhood")}
        maxLength={60}
      />
      <TextField
        ready={hydrated}
        id="city"
        label="Ciudad"
        required
        value={values.city}
        error={errors.city}
        onChange={set("city")}
        autoComplete="address-level2"
        maxLength={60}
      />
      <TextField
        ready={hydrated}
        id="whatsapp"
        label="WhatsApp"
        value={values.whatsapp}
        error={errors.whatsapp}
        onChange={set("whatsapp")}
        autoComplete="tel-national"
        maxLength={14}
        prefix="+57"
        inputMode="numeric"
        placeholder="300 123 4567"
      />

      {formError && (
        <p role="alert" className="text-14 text-danger">
          {formError}
        </p>
      )}
      <Button
        type="submit"
        disabled={!hydrated || pending}
        className="mt-2 w-full self-center md:w-[320px]"
      >
        {pending && <LoaderCircle className="animate-spin" />}
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
