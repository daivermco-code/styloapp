"use client";

import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Fab } from "@/shared/components/fab";
import { NO_INVOICING_PERMISSION } from "../types/messages";

// El + de Facturas (T-8.2.1, US-040 y US-042): abre el editor; al profesional sin el permiso de
// facturación le avisa (UI A.2). La base lo vuelve a revisar al guardar.
export function NewInvoiceFab({ canInvoice }: { canInvoice: boolean }) {
  if (!canInvoice) {
    return (
      <Fab
        label="Crear una factura"
        icon={<Plus />}
        onClick={() =>
          toast.error(NO_INVOICING_PERMISSION, { id: "sin-permiso-factura" })
        }
      />
    );
  }
  return (
    <Fab label="Crear una factura" icon={<Plus />} href="/pro/facturas/nueva" />
  );
}
