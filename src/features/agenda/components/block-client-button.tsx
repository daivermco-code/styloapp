"use client";

import { Ban, LoaderCircle, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { setClientBlocked } from "../services/block-actions";

/**
 * Cómo se ve el botón:
 * - `ghost`: en la cita, centrado y sin borde;
 * - `outline`: en la ficha del cliente, con borde (rojo para bloquear);
 * - `compact`: en la lista de bloqueados, chico con borde y solo "Desbloquear".
 */
type BlockButtonLook = "ghost" | "outline" | "compact";

function buttonClass(look: BlockButtonLook, blocked: boolean): string {
  const color = blocked ? "text-primary" : "text-danger hover:text-danger";
  if (look === "ghost") return cn("self-center", color);
  if (look === "outline")
    return cn(
      "self-center",
      color,
      blocked ? "border-primary" : "border-danger hover:bg-danger/10",
    );
  return "shrink-0 border-primary text-primary";
}

function buttonLabel(look: BlockButtonLook, blocked: boolean): string {
  if (look === "compact") return "Desbloquear";
  return blocked ? "Desbloquear usuario" : "Bloquear usuario";
}

/**
 * "Bloquear usuario" y "Desbloquear usuario" (US-020), con su confirmación. Lo usan la cita, la
 * ficha del cliente y Usuarios bloqueados. Solo el dueño: la acción lo vuelve a revisar.
 */
export function BlockClientButton({
  clientId,
  name,
  blocked,
  look = "ghost",
}: {
  clientId: string;
  name: string;
  blocked: boolean;
  look?: BlockButtonLook;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useActionTransition();
  const confirm = () => {
    startTransition(async () => {
      const result = await setClientBlocked({ clientId, blocked: !blocked });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setOpen(false);
      toast.success(
        blocked ? `Desbloqueaste a ${name}` : `Bloqueaste a ${name}`,
      );
      router.refresh();
    });
  };
  const Icon = blocked ? UserCheck : Ban;
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={look === "ghost" ? "ghost" : "outline"}
          size={look === "compact" ? "sm" : "default"}
          disabled={!hydrated}
          aria-label={look === "compact" ? `Desbloquear a ${name}` : undefined}
          className={buttonClass(look, blocked)}
        >
          {look !== "compact" && <Icon aria-hidden />}
          {buttonLabel(look, blocked)}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-32px)] rounded-card">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {blocked ? `¿Desbloquear a ${name}?` : `¿Bloquear a ${name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-14 text-ink">
            {blocked
              ? "Podrá volver a reservar en línea en tu negocio."
              : "No podrá reservar en línea en tu negocio. Sus citas agendadas siguen."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={pending} className="mt-0">
            Ahora no
          </AlertDialogCancel>
          <Button
            type="button"
            variant={blocked ? "default" : "destructive"}
            onClick={confirm}
            disabled={pending}
          >
            {pending && <LoaderCircle className="animate-spin" />}
            {blocked ? "Sí, desbloquear" : "Sí, bloquear"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
