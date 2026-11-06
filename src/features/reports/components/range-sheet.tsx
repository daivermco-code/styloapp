"use client";

import { SlidersHorizontal } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { FieldBox } from "@/shared/components/field-box";
import { useInstantNav } from "@/shared/components/instant-nav";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { NAV_GROUP } from "@/shared/lib/instant-nav";
import { reportsHref } from "../lib/display";
import type { ReportView } from "../lib/filters";
import { reportRangeSchema } from "../types/schemas";

interface RangeSheetProps {
  /** Lo que se mira: Aplicar lo deja igual y le pone el rango. */
  view: ReportView;
}

/** Lo que falta, para "Falta: …", y el error de Hasta (al revés o de más de un año). */
function checkRange(from: string, to: string) {
  const check = reportRangeSchema.safeParse({ from, to });
  const missing = [!from && "Desde", !to && "Hasta"].filter(
    (name): name is string => Boolean(name),
  );
  const toError =
    missing.length === 0 && !check.success
      ? check.error.issues.find((issue) => issue.path[0] === "to")?.message
      : undefined;
  return { check, missing, toError };
}

function RangeForm({ view, onDone }: RangeSheetProps & { onDone: () => void }) {
  const { navigate } = useInstantNav();
  const [from, setFrom] = useState(view.range?.from ?? "");
  const [to, setTo] = useState(view.range?.to ?? "");
  const { check, missing, toError } = checkRange(from, to);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!check.success) return;
    // La hoja se cierra de una y el informe sale en esqueleto mientras llega (Fase 17).
    onDone();
    navigate(reportsHref(view, { range: check.data }), NAV_GROUP.reportRange);
  };

  return (
    <form onSubmit={submit} noValidate className="mt-2 flex flex-col gap-5">
      <p className="text-12 text-slate">Los campos con * son obligatorios.</p>
      <FieldBox id="range-from" label="Desde" required>
        <Input
          id="range-from"
          type="date"
          value={from}
          aria-required
          onChange={(event) => setFrom(event.target.value)}
        />
      </FieldBox>
      <FieldBox id="range-to" label="Hasta" required error={toError}>
        <Input
          id="range-to"
          type="date"
          value={to}
          min={from || undefined}
          aria-required
          aria-invalid={toError ? true : undefined}
          aria-describedby={toError ? "range-to-error" : undefined}
          onChange={(event) => setTo(event.target.value)}
        />
      </FieldBox>
      <div className="flex flex-col gap-2">
        {/* DESIGN.md: lo que falta va encima del botón desactivado, en 12 px rojo. */}
        {missing.length > 0 && (
          <p className="text-center text-12 text-danger">
            Falta: {missing.join(", ")}.
          </p>
        )}
        <Button type="submit" disabled={!check.success}>
          Aplicar
        </Button>
      </div>
    </form>
  );
}

// "Filtrar: Rango" (T-13.1.1, US-053, pantalla 21): el ícono de filtro de la barra abre la hoja
// inferior con Desde y Hasta; en el computador es una ventana centrada de 420 px. Aplicar pone
// el rango en la URL; la hoja monta el formulario de nuevo cada vez que se abre.
export function RangeSheet({ view }: RangeSheetProps) {
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Filtrar: Rango"
        disabled={!hydrated}
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-primary hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
      >
        <SlidersHorizontal className="size-6" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-[720px] pb-8 md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[420px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-sheet md:border"
        >
          <SheetTitle className="text-20 font-bold text-primary">
            Filtrar: Rango
          </SheetTitle>
          <SheetDescription className="sr-only">
            Elige desde qué día y hasta qué día ver los informes.
          </SheetDescription>
          {open && <RangeForm view={view} onDone={() => setOpen(false)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
