"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { requestCode } from "../services/actions";
import { showCodeNotice } from "./sms-notice";

interface PhoneFormProps {
  /** Los 10 dígitos, ya escritos si se eligió una persona de la demo. */
  defaultPhone: string;
  next: string | null;
}

// "Tu número de celular" (US-003): el +57 va fijo y "Enviar código" deja el código en la bandeja.
// El campo no es controlado: lo que se escriba antes de que React tome la página no se borra. El
// botón espera a React (sin cambiar de color): un toque antes enviaría el formulario a la antigua
// y recargaría la página.
export function PhoneForm({ defaultPhone, next }: PhoneFormProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  // Sin internet, el aviso "Sin conexión" y el formulario se quedan (revisión, punto 6).
  const [pending, startTransition] = useActionTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const phone = String(new FormData(event.currentTarget).get("phone") ?? "");
    startTransition(async () => {
      const result = await requestCode({ phone });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      if (result.data.notice) showCodeNotice(result.data.notice);
      router.push(
        next
          ? `/entrar/codigo?siguiente=${encodeURIComponent(next)}`
          : "/entrar/codigo",
      );
    });
  };

  return (
    <form
      method="post"
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="phone" className="text-14 font-bold text-ink">
          Celular
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-16 font-bold text-ink">
            +57
          </span>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="300 123 4567"
            maxLength={14}
            defaultValue={defaultPhone}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "phone-error" : undefined}
            className="pl-14 focus-visible:pl-[55px]"
          />
        </div>
        {error && (
          <p id="phone-error" role="alert" className="text-14 text-danger">
            {error}
          </p>
        )}
      </div>
      <Button
        type="submit"
        disabled={pending || !hydrated}
        className={cn("w-full", !hydrated && "disabled:bg-primary")}
      >
        {pending && <LoaderCircle className="animate-spin" />}
        {pending ? "Enviando…" : "Enviar código"}
      </Button>
    </form>
  );
}
