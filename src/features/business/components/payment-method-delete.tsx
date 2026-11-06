"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { AppErrorCode } from "@/shared/types/action-result";
import {
  deletePaymentMethod,
  savePaymentMethod,
} from "../services/payment-actions";
import type { PaymentMethod } from "../types/payment";

interface PaymentMethodDeleteProps {
  method: PaymentMethod;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
  onDeactivated: (method: PaymentMethod) => void;
}

// Confirmación de borrar un método de pago (US-039). Si ya se usó, la base no lo deja borrar y la
// ventana cambia: explica por qué y ofrece desactivarlo. Se monta cada vez que se abre.
export function PaymentMethodDelete({
  method,
  open,
  onOpenChange,
  onDeleted,
  onDeactivated,
}: PaymentMethodDeleteProps) {
  const [inUse, setInUse] = useState<string | null>(null);
  const [pending, startTransition] = useActionTransition();

  const remove = () => {
    startTransition(async () => {
      const result = await deletePaymentMethod({ id: method.id });
      if (!result.ok) {
        if (result.error.code === AppErrorCode.IN_USE) {
          setInUse(result.error.message);
          return;
        }
        toast.error(result.error.message);
        onOpenChange(false);
        return;
      }
      toast.success(`Borraste ${result.data.name}.`);
      onDeleted();
    });
  };

  const deactivate = () => {
    startTransition(async () => {
      const result = await savePaymentMethod({
        id: method.id,
        name: method.name,
        isActive: false,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        onOpenChange(false);
        return;
      }
      toast.success(`Desactivaste ${result.data.name}.`);
      onDeactivated(result.data);
    });
  };

  const offerDeactivate = inUse !== null && method.isActive;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100%-32px)] rounded-card">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {inUse
              ? `No se puede borrar ${method.name}`
              : `¿Borrar ${method.name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-14 text-ink">
            {inUse ??
              "Deja de salir al facturar y al anotar un gasto. No se puede deshacer."}
            {inUse && !method.isActive && " Ya está desactivado."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={pending} className="mt-0">
            {inUse && !offerDeactivate ? "Entendido" : "Cancelar"}
          </AlertDialogCancel>
          {!inUse && (
            <Button
              type="button"
              variant="destructive"
              onClick={remove}
              disabled={pending}
            >
              {pending && <LoaderCircle className="animate-spin" />}
              Borrar
            </Button>
          )}
          {offerDeactivate && (
            <Button type="button" onClick={deactivate} disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              Desactivar
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
