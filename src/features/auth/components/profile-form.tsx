"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
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
import { completeProfile } from "../services/actions";
import { GENDERS } from "../types/schemas";

type Gender = (typeof GENDERS)[number];

const GENDER_LABELS: Record<Gender, string> = {
  male: "Hombre",
  female: "Mujer",
  other: "Otro",
};

interface ProfileFormProps {
  defaultName: string;
  defaultGender: Gender | null;
  defaultBirthDate: string | null;
  /** Hoy en Bogotá ("2026-10-31"): la fecha de nacimiento no puede pasar de ahí. */
  today: string;
  next: string | null;
}

type FieldErrors = Partial<Record<"fullName" | "gender" | "birthDate", string>>;

// Completar el perfil la primera vez (US-003): nombre obligatorio, género y fecha opcionales.
export function ProfileForm({
  defaultName,
  defaultGender,
  defaultBirthDate,
  today,
  next,
}: ProfileFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(defaultName);
  const [gender, setGender] = useState<Gender | undefined>(
    defaultGender ?? undefined,
  );
  const [birthDate, setBirthDate] = useState(defaultBirthDate ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Sin internet, el aviso "Sin conexión" y lo escrito se quedan (revisión, punto 6).
  const [pending, startTransition] = useActionTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await completeProfile({
        fullName,
        gender,
        birthDate: birthDate || undefined,
        next: next ?? undefined,
      });
      if (!result.ok) {
        const { field, message } = result.error;
        if (
          field === "fullName" ||
          field === "gender" ||
          field === "birthDate"
        ) {
          setErrors({ [field]: message });
          setFormError(null);
        } else {
          setErrors({});
          setFormError(message);
        }
        return;
      }
      router.replace(result.data.redirectTo);
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="fullName" className="text-14 font-bold text-ink">
          Nombre y apellido
        </label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          maxLength={80}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={errors.fullName ? "fullName-error" : undefined}
        />
        {errors.fullName && (
          <p id="fullName-error" role="alert" className="text-14 text-danger">
            {errors.fullName}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="gender" className="text-14 font-bold text-ink">
          Género <span className="font-medium text-slate">(opcional)</span>
        </label>
        <Select
          value={gender}
          onValueChange={(value) => setGender(value as Gender)}
        >
          <SelectTrigger id="gender">
            <SelectValue placeholder="Elige uno" />
          </SelectTrigger>
          <SelectContent>
            {GENDERS.map((value) => (
              <SelectItem key={value} value={value}>
                {GENDER_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="birthDate" className="text-14 font-bold text-ink">
          Fecha de nacimiento{" "}
          <span className="font-medium text-slate">(opcional)</span>
        </label>
        <Input
          id="birthDate"
          name="birthDate"
          type="date"
          min="1900-01-01"
          max={today}
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
          aria-invalid={errors.birthDate ? true : undefined}
          aria-describedby={errors.birthDate ? "birthDate-error" : undefined}
        />
        {errors.birthDate && (
          <p id="birthDate-error" role="alert" className="text-14 text-danger">
            {errors.birthDate}
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className="text-14 text-danger">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending && <LoaderCircle className="animate-spin" />}
        {pending ? "Guardando…" : "Guardar y seguir"}
      </Button>
    </form>
  );
}
