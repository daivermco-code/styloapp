"use client";

import { Check, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useInstantNav } from "@/shared/components/instant-nav";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { isSelected, NAV_GROUP } from "@/shared/lib/instant-nav";

export interface FilterChoice {
  label: string;
  /** La dirección de Facturas con esta opción puesta. */
  href: string;
  selected: boolean;
}

interface InvoiceFiltersProps {
  filters: FilterChoice[];
  orders: FilterChoice[];
}

function ChoiceGroup({
  name,
  title,
  choices,
  group,
}: {
  name: string;
  title: string;
  choices: FilterChoice[];
  /** Su grupo de respuesta inmediata: la opción tocada se marca de una (Fase 17). */
  group: string;
}) {
  const { pending, navigate } = useInstantNav();
  return (
    <fieldset className="flex flex-col">
      <legend className="pb-1 text-18 font-bold text-primary">{title}</legend>
      {choices.map((choice) => {
        const checked = isSelected(
          choice.selected,
          choice.href,
          group,
          pending,
        );
        return (
          <label
            key={choice.label}
            className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-card px-1 text-16 text-ink hover:bg-primary-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
          >
            <input
              type="radio"
              name={name}
              checked={checked}
              onChange={() => navigate(choice.href, group)}
              className="sr-only"
            />
            {choice.label}
            <span
              aria-hidden
              className={cn(
                "flex size-6 items-center justify-center rounded-full border-2",
                checked
                  ? "border-primary bg-primary text-surface"
                  : "border-line",
              )}
            >
              {checked && <Check className="size-4" strokeWidth={3} />}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

// Filtrar y ordenar Facturas (T-8.2.1, US-042, pantalla 7): el ícono de la barra abre la hoja
// inferior con "Filtrar" (Pagadas, Anuladas, Sin filtro) y "Ordenar" en filas de radio de 48 px.
// Cada opción cambia la URL al momento y la hoja sigue abierta para elegir la otra.
export function InvoiceFilters({ filters, orders }: InvoiceFiltersProps) {
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Filtrar y ordenar"
        disabled={!hydrated}
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-primary hover:bg-primary-50 disabled:cursor-default"
      >
        <SlidersHorizontal className="size-6" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-[720px] pb-8">
          <SheetTitle className="text-20 font-bold text-primary">
            Filtrar y ordenar
          </SheetTitle>
          <SheetDescription className="sr-only">
            Elige qué facturas ver y en qué orden.
          </SheetDescription>
          <div className="mt-4 flex flex-col gap-6">
            <ChoiceGroup
              name="filtro"
              title="Filtrar"
              choices={filters}
              group={NAV_GROUP.invoiceFilters}
            />
            <ChoiceGroup
              name="orden"
              title="Ordenar"
              choices={orders}
              group={NAV_GROUP.invoiceOrder}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
