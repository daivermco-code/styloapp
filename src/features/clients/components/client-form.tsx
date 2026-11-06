"use client";

import { CircleCheck, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GENDERS } from "@/features/auth/types/schemas";
import { FieldBox } from "@/shared/components/field-box";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { localDigits } from "@/shared/lib/phone";
import { saveClient } from "../services/actions";
import {
  type ClientProfile,
  GENDER_LABELS,
  type Gender,
} from "../types/client";
import {
  FIRST_BIRTH_DATE,
  type SaveClientInput,
  saveClientSchema,
} from "../types/schemas";

type Field = "fullName" | "birthDate" | "gender" | "phone" | "notes";

const FIELD_LABELS: Record<Field, string> = {
  fullName: "Nombre",
  birthDate: "Fecha de nacimiento",
  gender: "Género",
  phone: "Número de contacto",
  notes: "Notas",
};

/** El valor del Select para quitar el género (Radix no deja opciones vacías). */
const NO_GENDER = "ninguno";

const TEXTAREA_CLASS =
  "w-full rounded-card border border-input bg-surface px-4 py-3 text-16 text-ink placeholder:text-slate focus:border-2 focus:border-primary focus:px-[15px] focus:py-[11px] focus:outline-none aria-[invalid=true]:border-danger";

interface Values {
  fullName: string;
  birthDate: string;
  gender: string;
  /** Los 10 dígitos, sin el +57. */
  phone: string;
  notes: string;
  whatsappOk: boolean;
  promosOk: boolean;
}

function initialValues(client: ClientProfile | null): Values {
  return {
    fullName: client?.fullName ?? "",
    birthDate: client?.birthDate ?? "",
    gender: client?.gender ?? "",
    phone: client?.phone ? (localDigits(client.phone) ?? "") : "",
    notes: client?.notes ?? "",
    // Como en la base: los mensajes de las citas sí y las promociones no, hasta que lo autorice.
    whatsappOk: client?.whatsappOk ?? true,
    promosOk: client?.promosOk ?? false,
  };
}

/** Lo que se escribe o se pega en el celular: hasta 16 caracteres ("+57 300 123 4567"). */
const PHONE_INPUT_MAX = 16;

/** Solo los 10 dígitos: quita espacios y guiones, y el 57 de adelante si viene completo. */
function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local =
    digits.length === 12 && digits.startsWith("57") ? digits.slice(2) : digits;
  return local.slice(0, 10);
}

/** La bandera de Colombia, al lado del +57 fijo (captura 62). */
function ColombiaFlag() {
  return (
    <svg
      viewBox="0 0 6 4"
      aria-hidden
      className="h-4 w-6 shrink-0 rounded-[2px]"
    >
      <rect width="6" height="2" fill="#FCD116" />
      <rect y="2" width="6" height="1" fill="#003893" />
      <rect y="3" width="6" height="1" fill="#CE1126" />
    </svg>
  );
}

function toGender(value: string): Gender | null {
  return GENDERS.find((gender) => gender === value) ?? null;
}

interface ClientFormProps {
  client: ClientProfile | null;
  /** Hoy en Bogotá ("YYYY-MM-DD"): nadie nace después. */
  today: string;
}

// Editor de cliente (T-10.1.3, US-048, pantalla 15, captura 62): nombre, fecha de nacimiento,
// género, número de contacto (+57 fijo), notas y las dos autorizaciones de WhatsApp. Con algo
// inválido el botón queda apagado y dice qué falta; el campo lo dice al salir de él.
export function ClientForm({ client, today }: ClientFormProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [initial] = useState(() => initialValues(client));
  // Con cuenta en la app, el celular es el de su cuenta: aquí solo se ve (si lo comparte).
  const accountPhone = client?.hasAccount ?? false;
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [serverError, setServerError] = useState<{
    field?: string;
    message: string;
  } | null>(null);
  const [pending, startTransition] = useActionTransition();

  const gender = toGender(values.gender);
  const input: SaveClientInput = {
    clientId: client?.id,
    fullName: values.fullName,
    birthDate: values.birthDate || null,
    gender,
    // Si no lo tocó, el celular se queda como está (puede ser uno que el cliente no comparte).
    phone:
      accountPhone || values.phone === initial.phone ? undefined : values.phone,
    notes: values.notes,
    whatsappOk: values.whatsappOk,
    promosOk: values.promosOk,
  };
  const check = saveClientSchema(today).safeParse(input);
  const issues: Partial<Record<Field, string>> = {};
  if (!check.success) {
    for (const issue of check.error.issues) {
      const field = issue.path[0] as Field;
      issues[field] ??= issue.message;
    }
  }
  const errorOf = (field: Field) =>
    (serverError?.field === field ? serverError.message : undefined) ??
    (touched[field] ? issues[field] : undefined);
  const describedBy = (field: Field) =>
    errorOf(field) ? `${field}-error` : undefined;
  const missing = (Object.keys(issues) as Field[]).map(
    (field) => FIELD_LABELS[field],
  );

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setServerError(null);
  };
  const touch = (field: Field) =>
    setTouched((current) => ({ ...current, [field]: true }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!check.success) return;
    startTransition(async () => {
      const result = await saveClient(input);
      if (!result.ok) {
        setServerError(result.error);
        if (result.error.field) touch(result.error.field as Field);
        return;
      }
      toast.success(
        result.data.created ? "Cliente creado." : "Cambios guardados.",
      );
      // replace: Atrás desde la ficha no vuelve al editor con los datos de antes.
      router.replace(`/pro/clientes/${result.data.id}`);
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <p className="text-14 text-slate">Los campos con * son obligatorios.</p>

      <FieldBox
        id="fullName"
        label="Nombre"
        required
        error={errorOf("fullName")}
      >
        <Input
          id="fullName"
          value={values.fullName}
          onChange={(event) => set("fullName", event.target.value)}
          onBlur={() => touch("fullName")}
          readOnly={!hydrated}
          maxLength={80}
          autoComplete="off"
          aria-required
          aria-invalid={errorOf("fullName") ? true : undefined}
          aria-describedby={describedBy("fullName")}
        />
      </FieldBox>

      <FieldBox
        id="birthDate"
        label="Fecha de nacimiento"
        error={errorOf("birthDate")}
      >
        <Input
          id="birthDate"
          type="date"
          min={FIRST_BIRTH_DATE}
          max={today}
          value={values.birthDate}
          onChange={(event) => {
            // Del calendario se elige sin escribir: el error sale de una vez, no al salir.
            set("birthDate", event.target.value);
            touch("birthDate");
          }}
          onBlur={() => touch("birthDate")}
          readOnly={!hydrated}
          aria-invalid={errorOf("birthDate") ? true : undefined}
          aria-describedby={describedBy("birthDate")}
        />
      </FieldBox>

      <FieldBox id="gender" label="Género" error={errorOf("gender")}>
        <Select
          value={values.gender}
          onValueChange={(value) =>
            set("gender", value === NO_GENDER ? "" : value)
          }
          disabled={!hydrated}
        >
          <SelectTrigger id="gender">
            {/* El texto va dado: así se ve desde el primer pintado, antes de hidratar. */}
            <SelectValue placeholder="Elige un género">
              {gender && GENDER_LABELS[gender]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {GENDERS.map((gender) => (
              <SelectItem key={gender} value={gender}>
                {GENDER_LABELS[gender]}
              </SelectItem>
            ))}
            {values.gender && (
              <SelectItem value={NO_GENDER}>Sin especificar</SelectItem>
            )}
          </SelectContent>
        </Select>
      </FieldBox>

      <FieldBox id="phone" label="Número de contacto" error={errorOf("phone")}>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-12 shrink-0 items-center gap-2 rounded-card border border-input px-3 text-16 text-slate"
          >
            <ColombiaFlag />
            +57
          </span>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            // Deja pegar "+57 300 123 4567": phoneDigits lo limpia.
            maxLength={PHONE_INPUT_MAX}
            autoComplete="off"
            placeholder={accountPhone ? undefined : "300 123 4567"}
            value={values.phone}
            onChange={(event) => set("phone", phoneDigits(event.target.value))}
            onBlur={() => touch("phone")}
            readOnly={!hydrated || accountPhone}
            className={accountPhone ? "bg-soft text-slate" : undefined}
            aria-invalid={errorOf("phone") ? true : undefined}
            aria-describedby={
              accountPhone ? "phone-hint" : describedBy("phone")
            }
          />
        </div>
        {accountPhone && (
          <p id="phone-hint" className="text-12 text-slate">
            Tiene cuenta en la app: el celular lo cambia el cliente desde ella.
          </p>
        )}
      </FieldBox>

      <FieldBox id="notes" label="Notas" error={errorOf("notes")}>
        <textarea
          id="notes"
          value={values.notes}
          onChange={(event) => set("notes", event.target.value)}
          onBlur={() => touch("notes")}
          readOnly={!hydrated}
          maxLength={500}
          rows={3}
          placeholder="Ej. Prefiere la máquina en 2."
          aria-invalid={errorOf("notes") ? true : undefined}
          aria-describedby={describedBy("notes")}
          className={TEXTAREA_CLASS}
        />
      </FieldBox>

      <div className="flex flex-col gap-2">
        <label className="flex min-h-11 items-center gap-3 text-14 text-ink">
          <Checkbox
            checked={values.whatsappOk}
            onCheckedChange={(value) => set("whatsappOk", value === true)}
            disabled={!hydrated}
          />
          El cliente me autorizó a escribirle por WhatsApp sobre sus citas.
        </label>
        <label className="flex min-h-11 items-center gap-3 text-14 text-ink">
          <Checkbox
            checked={values.promosOk}
            onCheckedChange={(value) => set("promosOk", value === true)}
            disabled={!hydrated}
          />
          El cliente me autorizó a mandarle promociones por WhatsApp.
        </label>
      </div>

      {serverError && !serverError.field && (
        <p role="alert" className="text-14 text-danger">
          {serverError.message}
        </p>
      )}
      <div className="flex flex-col items-center gap-2 pt-2">
        {/* DESIGN.md: lo que falta va encima del botón desactivado, en 12 px rojo. */}
        {missing.length > 0 && (
          <p className="text-center text-12 text-danger">
            Falta: {missing.join(", ")}.
          </p>
        )}
        <Button
          type="submit"
          disabled={!hydrated || !check.success || pending}
          className="w-full md:w-[320px]"
        >
          {pending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <CircleCheck />
          )}
          {pending ? "Guardando…" : client ? "Guardar cambios" : "Crear"}
        </Button>
      </div>
    </form>
  );
}
