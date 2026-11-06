"use client";

import { ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/components/empty-state";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { formatMinutes } from "@/shared/lib/duration";
import type {
  BookingCategoryOption,
  BookingServiceOption,
} from "../types/agenda";

interface ServicePickerProps {
  categories: BookingCategoryOption[];
  /** El elegido: su botón dice "Elegido". */
  selectedId: string | null;
  onPick: (service: BookingServiceOption) => void;
}

// Paso del servicio del editor (T-3.4.1, captura 04): categorías plegables con el nombre, el
// precio y "Seleccionar".
export function ServicePicker({
  categories,
  selectedId,
  onPick,
}: ServicePickerProps) {
  const hydrated = useHydrated();
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());

  const toggle = (id: string) =>
    setClosed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (categories.length === 0) {
    return (
      <EmptyState message="No hay servicios para agendar: revisa que el equipo tenga servicios asignados." />
    );
  }

  return (
    <div className="flex flex-col pb-10">
      {categories.map((category) => {
        const open = !closed.has(category.id);
        return (
          <section key={category.id}>
            <h3>
              <button
                type="button"
                aria-expanded={open}
                disabled={!hydrated}
                onClick={() => toggle(category.id)}
                className="flex min-h-12 w-full items-center gap-3 border-b border-stroke px-5 text-left text-18 font-bold text-primary disabled:cursor-default"
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
                  <li
                    key={service.id}
                    className="flex min-h-[72px] items-center gap-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-16 text-ink">{service.name}</p>
                      <p className="text-14 text-slate">
                        {service.priceLabel} ·{" "}
                        {formatMinutes(service.durationMinutes)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!hydrated}
                      aria-label={`Seleccionar ${service.name}`}
                      variant={
                        service.id === selectedId ? "outline" : "default"
                      }
                      onClick={() => onPick(service)}
                    >
                      {service.id === selectedId ? "Elegido" : "Seleccionar"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
