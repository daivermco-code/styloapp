"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { resendCode, verifyCode } from "../services/actions";
import { CodeBoxes } from "./code-boxes";
import { showCodeNotice } from "./sms-notice";

interface CodeFormProps {
  /** "+57 300 555 0121", para el texto de arriba. */
  phoneLabel: string;
  next: string | null;
  backHref: string;
}

// "Confirma tu número" (US-003): casillas del código, Enviar, Atrás y pedir uno nuevo.
export function CodeForm({ phoneLabel, next, backHref }: CodeFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Cambia con cada código nuevo: las casillas vuelven a empezar con el cursor en la primera.
  const [round, setRound] = useState(0);
  // Sin internet, el aviso "Sin conexión" y las casillas con el código se quedan (revisión, punto 6).
  const [verifying, startVerify] = useActionTransition();
  const [resending, startResend] = useActionTransition();
  const busy = verifying || resending;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startVerify(async () => {
      const result = await verifyCode({ code, next: next ?? undefined });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      // Ya entró: el aviso del código no tapa la página a la que llega.
      toast.dismiss();
      router.replace(result.data.redirectTo);
    });
  };

  const resend = () =>
    startResend(async () => {
      const result = await resendCode();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setCode("");
      setError(null);
      setRound((value) => value + 1);
      if (result.data.notice) showCodeNotice(result.data.notice);
    });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <p className="text-16 text-ink">
        Escribe el código que llegó al{" "}
        <strong className="whitespace-nowrap">{phoneLabel}</strong>. Lo
        encuentras en la bandeja de la demo.
      </p>
      <div className="flex flex-col gap-3">
        <CodeBoxes
          key={round}
          value={code}
          onChange={(value) => {
            setCode(value);
            if (error) setError(null);
          }}
          invalid={Boolean(error)}
          disabled={busy}
          describedBy={error ? "code-error" : undefined}
        />
        {error && (
          <p
            id="code-error"
            role="alert"
            className="text-center text-14 text-danger"
          >
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={busy} className="w-full">
          {verifying && <LoaderCircle className="animate-spin" />}
          {verifying ? "Entrando…" : "Enviar"}
        </Button>
        <Button asChild variant="link" className="w-full">
          <Link href={backHref}>Atrás</Link>
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={resend}
        className="self-center text-14"
      >
        {resending && <LoaderCircle className="animate-spin" />}
        {resending ? "Pidiendo…" : "¿No te llegó o ya venció? Pedir uno nuevo"}
      </Button>
    </form>
  );
}
