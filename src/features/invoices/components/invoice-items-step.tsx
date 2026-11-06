"use client";

import { ArrowRight, Check, ChevronUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  BookingCategoryOption,
  BookingServiceOption,
} from "@/features/agenda/types/agenda";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/components/empty-state";
import { MoneyInput } from "@/shared/components/money-input";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { type DraftItem, MAX_ITEMS, proposedItem } from "../lib/draft";
import { useInvoiceDraft } from "../store/invoice-draft";
import { MISSING_PRICE, TOO_MANY_ITEMS } from "../types/schemas";

interface ItemFieldsProps {
  service: BookingServiceOption;
  item: DraftItem;
  /** El dueño elige el profesional; el profesional va fijo él. */
  canPickStaff: boolean;
}

// Lo que crece al marcar un servicio: el profesional y el valor (T-8.3.1, US-040).
function ItemFields({ service, item, canPickStaff }: ItemFieldsProps) {
  const hydrated = useHydrated();
  const updateItem = useInvoiceDraft((state) => state.updateItem);
  const staffId = `factura-pro-${service.id}`;
  const priceId = `factura-valor-${service.id}`;

  const changeStaff = (id: string) => {
    // El valor propuesto es el precio del servicio con ese profesional.
    const proposed = proposedItem(service, id);
    if (proposed) updateItem(service.id, proposed);
  };

  return (
    <div className="grid grid-cols-2 gap-3 pb-2">
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={staffId} className="text-12 font-bold text-slate">
          Profesional
        </label>
        <Select
          value={item.staffId}
          onValueChange={changeStaff}
          disabled={!hydrated || !canPickStaff || service.staff.length < 2}
        >
          <SelectTrigger id={staffId} className="h-12">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {service.staff.map((staff) => (
              <SelectItem key={staff.id} value={staff.id}>
                {staff.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={priceId} className="text-12 font-bold text-slate">
          Valor
        </label>
        <MoneyInput
          id={priceId}
          value={item.price}
          disabled={!hydrated}
          invalid={item.price === null}
          aria-describedby={
            item.price === null ? `${priceId}-error` : undefined
          }
          onChange={(price) => updateItem(service.id, { price })}
        />
        {item.price === null && (
          <p id={`${priceId}-error`} className="text-12 text-danger">
            {MISSING_PRICE}
          </p>
        )}
      </div>
    </div>
  );
}

interface ServiceRowProps {
  service: BookingServiceOption;
  canPickStaff: boolean;
}

// Un servicio con su precio en 12 gris y el círculo para marcarlo; marcado, crece.
function ServiceRow({ service, canPickStaff }: ServiceRowProps) {
  const hydrated = useHydrated();
  const items = useInvoiceDraft((state) => state.items);
  const toggleItem = useInvoiceDraft((state) => state.toggleItem);
  const item = items.find((it) => it.serviceId === service.id);

  const toggle = () => {
    if (item) {
      toggleItem(item);
      return;
    }
    if (items.length >= MAX_ITEMS) {
      toast.error(TOO_MANY_ITEMS, { id: "maximo-servicios" });
      return;
    }
    const proposed = proposedItem(service);
    if (proposed) toggleItem(proposed);
  };

  return (
    <li className="flex flex-col">
      <button
        type="button"
        role="checkbox"
        aria-checked={Boolean(item)}
        disabled={!hydrated}
        onClick={toggle}
        className="flex min-h-[64px] w-full items-center gap-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-16 text-ink">{service.name}</span>
          {service.priceLabel && (
            <span className="block text-12 text-slate">
              {service.priceLabel}
            </span>
          )}
        </span>
        <span
          aria-hidden
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary",
            item && "bg-primary text-primary-foreground",
          )}
        >
          {item && <Check className="size-5" strokeWidth={3} />}
        </span>
      </button>
      {item && (
        <ItemFields service={service} item={item} canPickStaff={canPickStaff} />
      )}
    </li>
  );
}

interface InvoiceItemsStepProps {
  categories: BookingCategoryOption[];
  canPickStaff: boolean;
}

// Paso 2 del editor (T-8.3.1, US-040, pantalla 8, captura 57): "Elige los servicios que
// vendiste" con las categorías plegables; los productos llegan después. "Siguiente" va abajo a la
// derecha y está apagado hasta marcar un servicio (y con todos los valores escritos).
export function InvoiceItemsStep({
  categories,
  canPickStaff,
}: InvoiceItemsStepProps) {
  const hydrated = useHydrated();
  const items = useInvoiceDraft((state) => state.items);
  const goTo = useInvoiceDraft((state) => state.goTo);
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const ready = items.length > 0 && items.every((item) => item.price !== null);

  const toggleCategory = (id: string) =>
    setClosed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex min-h-[calc(100dvh-56px)] flex-col">
      <h2 className="px-5 pb-2 pt-5 text-18 font-bold text-primary">
        Elige los servicios que vendiste
      </h2>
      {categories.length === 0 && (
        <EmptyState message="No hay servicios para facturar: revisa que el equipo tenga servicios asignados." />
      )}
      {categories.map((category) => {
        const open = !closed.has(category.id);
        return (
          <section key={category.id}>
            <h3>
              <button
                type="button"
                aria-expanded={open}
                disabled={!hydrated}
                onClick={() => toggleCategory(category.id)}
                className="flex min-h-12 w-full items-center gap-3 border-b border-stroke px-5 text-left text-16 font-bold text-primary disabled:cursor-default"
              >
                <ChevronUp
                  aria-hidden
                  className={cn(
                    "size-5 transition-transform duration-180",
                    !open && "rotate-180",
                  )}
                />
                {category.name}
              </button>
            </h3>
            {open && (
              <ul className="flex flex-col divide-y divide-line px-5">
                {category.services.map((service) => (
                  <ServiceRow
                    key={service.id}
                    service={service}
                    canPickStaff={canPickStaff}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <h2 className="px-5 pb-1 pt-8 text-18 font-bold text-primary">
        Elige los productos que vendiste
      </h2>
      <p className="px-5 text-14 text-slate">
        Los productos llegan en una próxima etapa de la demo.
      </p>

      <div className="sticky bottom-0 mt-auto flex justify-end px-5 pb-6 pt-8">
        <Button
          type="button"
          disabled={!hydrated || !ready}
          onClick={() => goTo(3)}
          className="shadow-card"
        >
          Siguiente
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
