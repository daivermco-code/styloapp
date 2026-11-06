"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { linkToBusiness } from "../services/actions";
import { linkStaffSchema } from "../types/schemas";

interface LinkFormProps {
  /** El código del QR (?codigo=), si llegó por ahí. */
  initialCode: string;
  /** El primer nombre de la persona, para la agenda. */
  initialName: string;
}

const onlyLetters = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);

// "Vincularme a un negocio" (US-012, ASCII del Blueprint): el código de 6 letras que el dueño ve
// en Equipo y el nombre con que sale en la agenda.
export function LinkForm({ initialCode, initialName }: LinkFormProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [code, setCode] = useState(onlyLetters(initialCode));
  const [name, setName] = useState(initialName);
  const [errors, setErrors] = useState<{ code?: string; displayName?: string }>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useActionTransition();
  const valid = linkStaffSchema.safeParse({ code, displayName: name }).success;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await linkToBusiness({ code, displayName: name });
      if (!result.ok) {
        const { field, message } = result.error;
        if (field === "code" || field === "displayName") {
          setErrors({ [field]: message });
          setFormError(null);
          document.getElementById(field)?.focus();
        } else {
          setErrors({});
          setFormError(message);
        }
        return;
      }
      toast.success(`Ya estás en el equipo de ${result.data.businessName}.`);
      router.replace("/pro");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="code" className="text-14 font-bold text-ink">
          Código del negocio <span aria-hidden="true">*</span>
        </label>
        <Input
          id="code"
          name="code"
          value={code}
          readOnly={!hydrated}
          onChange={(event) => {
            setCode(onlyLetters(event.target.value));
            setErrors((current) => ({ ...current, code: undefined }));
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={6}
          placeholder="ABCDEF"
          aria-invalid={errors.code ? true : undefined}
          aria-describedby={errors.code ? "code-error" : "code-hint"}
          className="text-20 font-bold uppercase tracking-[0.4em] placeholder:font-medium placeholder:tracking-[0.4em]"
        />
        {errors.code ? (
          <p id="code-error" role="alert" className="text-14 text-danger">
            {errors.code}
          </p>
        ) : (
          <p id="code-hint" className="text-12 text-slate">
            Son 6 letras. Mayúsculas o minúsculas da igual.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="displayName" className="text-14 font-bold text-ink">
          Tu nombre en la agenda <span aria-hidden="true">*</span>
        </label>
        <Input
          id="displayName"
          name="displayName"
          value={name}
          readOnly={!hydrated}
          onChange={(event) => {
            setName(event.target.value);
            setErrors((current) => ({ ...current, displayName: undefined }));
          }}
          autoComplete="given-name"
          maxLength={40}
          aria-invalid={errors.displayName ? true : undefined}
          aria-describedby={
            errors.displayName ? "displayName-error" : "displayName-hint"
          }
        />
        {errors.displayName ? (
          <p
            id="displayName-error"
            role="alert"
            className="text-14 text-danger"
          >
            {errors.displayName}
          </p>
        ) : (
          <p id="displayName-hint" className="text-12 text-slate">
            Así te ven el negocio y sus clientes al reservar.
          </p>
        )}
      </div>
      {formError && (
        <p role="alert" className="text-14 text-danger">
          {formError}
        </p>
      )}
      <Button
        type="submit"
        disabled={!hydrated || !valid || pending}
        className="w-full self-center md:w-[320px]"
      >
        {pending && <LoaderCircle className="animate-spin" />}
        {pending ? "Vinculando…" : "Vincularme"}
      </Button>
    </form>
  );
}
