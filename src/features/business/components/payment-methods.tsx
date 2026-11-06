"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Fab } from "@/shared/components/fab";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import type { PaymentMethod } from "../types/payment";
import { PaymentMethodDelete } from "./payment-method-delete";
import { PaymentMethodDialog } from "./payment-method-dialog";

type Open =
  | { kind: "edit"; method: PaymentMethod | null }
  | { kind: "delete"; method: PaymentMethod }
  | null;

const ICON_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-card transition-colors duration-120 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default [&_svg]:size-5";

// Métodos de pago (T-7.3.3, US-039, pantalla 16, captura 70): una tarjeta por método con el lápiz y
// la caneca, y "Agregar método de pago" abajo a la derecha.
export function PaymentMethods({ methods }: { methods: PaymentMethod[] }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [open, setOpen] = useState<Open>(null);
  // Cambia en cada apertura para que la ventana arranque limpia.
  const [openCount, setOpenCount] = useState(0);

  const show = (next: Exclude<Open, null>) => {
    setOpenCount((count) => count + 1);
    setOpen(next);
  };
  const done = () => {
    setOpen(null);
    router.refresh();
  };

  return (
    <>
      <ul className="flex flex-col gap-3">
        {methods.map((method) => (
          <li
            key={method.id}
            className="flex min-h-14 items-center gap-2 rounded-card bg-canvas pl-4 pr-1"
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-16 font-bold",
                method.isActive ? "text-primary" : "text-ink",
              )}
            >
              {method.name}
            </span>
            {!method.isActive && (
              <span className="rounded-full bg-line px-2.5 py-0.5 text-12 font-medium text-ink">
                Inactivo
              </span>
            )}
            <button
              type="button"
              disabled={!hydrated}
              onClick={() => show({ kind: "edit", method })}
              aria-label={`Editar ${method.name}`}
              className={cn(ICON_BUTTON, "text-primary")}
            >
              <Pencil />
            </button>
            <button
              type="button"
              disabled={!hydrated}
              onClick={() => show({ kind: "delete", method })}
              aria-label={`Borrar ${method.name}`}
              className={cn(ICON_BUTTON, "text-warning")}
            >
              <Trash2 />
            </button>
          </li>
        ))}
      </ul>

      <Fab
        extended
        label="Agregar método de pago"
        icon={<Plus />}
        onClick={() => show({ kind: "edit", method: null })}
      />

      {open?.kind === "edit" && (
        <PaymentMethodDialog
          key={openCount}
          method={open.method}
          open
          onOpenChange={(next) => !next && setOpen(null)}
          onSaved={(method, created) => {
            toast.success(
              created
                ? `Agregaste ${method.name}.`
                : `Guardaste ${method.name}.`,
            );
            done();
          }}
        />
      )}
      {open?.kind === "delete" && (
        <PaymentMethodDelete
          key={openCount}
          method={open.method}
          open
          onOpenChange={(next) => !next && setOpen(null)}
          onDeleted={done}
          onDeactivated={done}
        />
      )}
    </>
  );
}
