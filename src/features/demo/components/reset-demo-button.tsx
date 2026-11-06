"use client";

import { LoaderCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { resetDemo } from "../services/actions";

// "Reiniciar demo" con su confirmación (US-005).
export function ResetDemoButton({
  variant = "outline",
}: Pick<ButtonProps, "variant">) {
  const router = useRouter();
  const [pending, startTransition] = useActionTransition();

  const reset = () =>
    startTransition(async () => {
      const result = await resetDemo({ confirm: true });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("La demo quedó como nueva.");
      router.replace("/");
      router.refresh();
    });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}
          {pending ? "Reiniciando…" : "Reiniciar demo"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-32px)] rounded-card">
        <AlertDialogHeader>
          <AlertDialogTitle>Reiniciar demo</AlertDialogTitle>
          <AlertDialogDescription>
            Se borra lo que hiciste y vuelven los datos de demo. ¿Seguimos?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="h-12 rounded-full text-16 font-bold">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={reset}
            className="h-12 rounded-full text-16 font-bold"
          >
            Reiniciar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
