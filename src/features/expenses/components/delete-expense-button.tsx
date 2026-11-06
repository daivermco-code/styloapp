"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
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
import { expensesHref } from "../lib/view";
import { deleteExpense } from "../services/actions";
import type { Expense } from "../types/expense";

// "Borrar gasto" del editor (T-9.1.1, US-044): en rojo y con confirmación. Al borrarlo vuelve a
// Gastos, en el mes del gasto.
export function DeleteExpenseButton({
  expense,
  disabled,
}: {
  expense: Expense;
  disabled?: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useActionTransition();

  const confirm = () => {
    startTransition(async () => {
      const result = await deleteExpense({ expenseId: expense.id });
      setOpen(false);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Gasto borrado.");
      // replace: el editor de un gasto borrado no queda detrás en el historial (Atrás daría 404).
      router.replace(expensesHref({ period: "mes", day: expense.paidOn }));
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={!hydrated || disabled}
          className="w-full self-center border-danger text-danger hover:bg-danger/5 md:w-[320px]"
        >
          <Trash2 />
          Borrar gasto
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-32px)] rounded-card">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Borrar el gasto {expense.name}?</AlertDialogTitle>
          <AlertDialogDescription className="text-14 text-ink">
            Sale de los gastos y del total, y no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={pending} className="mt-0">
            No, dejarlo
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            onClick={confirm}
            disabled={pending}
          >
            {pending && <LoaderCircle className="animate-spin" />}
            Sí, borrar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
