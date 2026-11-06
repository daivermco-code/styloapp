"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
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
import { invoiceTitle } from "../lib/totals";
import { voidInvoice } from "../services/actions";

interface InvoiceDetailActionsProps {
  invoiceId: string;
  invoiceNumber: number;
}

// "Editar factura" y "Anular" del detalle (T-8.2.2, US-043, pantalla 9): con borde y del mismo
// ancho; Anular en rojo. Anular pide confirmar con el texto de la historia y, al quedar anulada,
// la página se vuelve a pedir: sale la pastilla roja y ya no hay botones.
export function InvoiceDetailActions({
  invoiceId,
  invoiceNumber,
}: InvoiceDetailActionsProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useActionTransition();
  const title = invoiceTitle(invoiceNumber);

  const confirm = () => {
    startTransition(async () => {
      const result = await voidInvoice({ invoiceId });
      setOpen(false);
      if (!result.ok) {
        toast.error(result.error.message);
        router.refresh();
        return;
      }
      toast.success(`${title} anulada.`);
      router.refresh();
    });
  };

  return (
    <div className="flex gap-3">
      <Button asChild variant="outline" className="flex-1">
        <Link href={`/pro/facturas/${invoiceId}/editar`}>Editar factura</Link>
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={!hydrated}
            className="flex-1 border-danger text-danger hover:bg-danger/5"
          >
            Anular
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="w-[calc(100%-32px)] rounded-card">
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Anular la {title.toLowerCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-14 text-ink">
              Sale de los totales y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={pending} className="mt-0">
              No, dejarla
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={confirm}
              disabled={pending}
            >
              {pending && <LoaderCircle className="animate-spin" />}
              Sí, anular
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
