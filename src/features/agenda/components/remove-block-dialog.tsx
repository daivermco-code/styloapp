"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { minuteOfDay } from "../lib/grid";
import { deleteBlock } from "../services/block-actions";
import type { AgendaBlock } from "../types/agenda";
import { clockRange } from "./grid-parts";

interface RemoveBlockDialogProps {
  /** El bloqueo a quitar; null la deja cerrada. */
  block: AgendaBlock | null;
  day: string;
  onOpenChange: (open: boolean) => void;
}

/** Quitar un bloqueo (US-021), desde la agenda o desde el modo de bloqueo. */
export function RemoveBlockDialog({
  block,
  day,
  onOpenChange,
}: RemoveBlockDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useActionTransition();
  const remove = () => {
    if (!block) return;
    startTransition(async () => {
      const result = await deleteBlock({ blockId: block.id });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Bloqueo quitado");
      onOpenChange(false);
      router.refresh();
    });
  };
  return (
    <AlertDialog open={block !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100%-32px)] rounded-card">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Quitar este bloqueo?</AlertDialogTitle>
          <AlertDialogDescription className="text-14 text-ink">
            {block &&
              `De ${clockRange(minuteOfDay(block.startsAt, day), minuteOfDay(block.endsAt, day))}. `}
            Esas horas vuelven a quedar libres.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={pending} className="mt-0">
            No, dejarlo
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            onClick={remove}
            disabled={pending}
          >
            {pending && <LoaderCircle className="animate-spin" />}
            Sí, quitar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
