"use client";

import { LoaderCircle } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { savePaymentMethod } from "../services/payment-actions";
import type { PaymentMethod } from "../types/payment";

interface PaymentMethodDialogProps {
  /** null = uno nuevo. */
  method: PaymentMethod | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (method: PaymentMethod, created: boolean) => void;
}

// Ventana de un método de pago (US-039, pantalla 16): nombre, si está activo y Guardar. Se monta
// cada vez que se abre, así arranca con los datos del método tocado.
export function PaymentMethodDialog({
  method,
  open,
  onOpenChange,
  onSaved,
}: PaymentMethodDialogProps) {
  const [name, setName] = useState(method?.name ?? "");
  const [isActive, setIsActive] = useState(method?.isActive ?? true);
  const [error, setError] = useState<{
    message: string;
    onName: boolean;
  } | null>(null);
  const [pending, startTransition] = useActionTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await savePaymentMethod({
        id: method?.id,
        name,
        isActive,
      });
      if (!result.ok) {
        setError({
          message: result.error.message,
          onName: result.error.field === "name",
        });
        return;
      }
      onSaved(result.data, method === null);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-6 px-6 pb-8 pt-12">
        <div className="flex flex-col gap-1 text-center">
          <DialogTitle className="text-18 font-bold text-primary">
            {method ? "Editar método de pago" : "Nuevo método de pago"}
          </DialogTitle>
          <DialogDescription className="text-14 text-slate">
            Cómo te pagan o cómo pagas: Efectivo, Banco, Nequi…
          </DialogDescription>
        </div>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="methodName" className="text-14 font-bold text-ink">
              Nombre <span aria-hidden="true">*</span>
            </label>
            <Input
              id="methodName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Por ejemplo, Nequi"
              maxLength={30}
              aria-invalid={error?.onName ? true : undefined}
              aria-describedby={error?.onName ? "methodName-error" : undefined}
            />
            {error?.onName && (
              <p
                id="methodName-error"
                role="alert"
                className="text-14 text-danger"
              >
                {error.message}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="methodActive" className="flex flex-col">
              <span className="text-16 text-ink">Activo</span>
              <span className="text-13 text-slate">
                Apagado, no sale al facturar ni al anotar un gasto.
              </span>
            </label>
            <Switch
              id="methodActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
          {error && !error.onName && (
            <p role="alert" className="text-14 text-danger">
              {error.message}
            </p>
          )}
          <Button
            type="submit"
            disabled={pending || name.trim().length === 0}
            className="w-full"
          >
            {pending && <LoaderCircle className="animate-spin" />}
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
