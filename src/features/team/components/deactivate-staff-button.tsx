"use client";

import { LoaderCircle, UserX } from "lucide-react";
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
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { deactivateStaff } from "../services/actions";

// "Desactivar" de cada profesional en Equipo (US-012), con confirmación.
export function DeactivateStaffButton({
  staffId,
  name,
}: {
  staffId: string;
  name: string;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useActionTransition();

  const confirm = () => {
    startTransition(async () => {
      const result = await deactivateStaff({ staffId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setOpen(false);
      toast.success(`Desactivaste a ${result.data.displayName}.`);
      router.refresh();
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          disabled={!hydrated}
          aria-label={`Desactivar a ${name}`}
          className="flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-card px-2 py-1 text-14 text-slate transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
        >
          <UserX className="size-5" />
          Desactivar
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-32px)] rounded-card">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Desactivar a {name}?</AlertDialogTitle>
          <AlertDialogDescription className="text-14 text-ink">
            Deja de salir para reservas nuevas y lo que ya hizo se conserva.
            Para volver, tendrá que escribir otra vez el código del negocio.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={pending} className="mt-0">
            Cancelar
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            onClick={confirm}
            disabled={pending}
          >
            {pending && <LoaderCircle className="animate-spin" />}
            Desactivar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
