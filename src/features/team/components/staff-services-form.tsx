"use client";

import { ChevronDown, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DURATION_RANGE } from "@/features/catalog/types/schemas";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { formatMinutes } from "@/shared/lib/duration";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { saveStaffServices } from "../services/actions";
import type { StaffServiceCategory } from "../types/team";

interface Choice {
  assigned: boolean;
  /** Minutos escritos; vacío = la duración del servicio. */
  duration: string;
}

type Choices = Record<string, Choice>;

function initialChoices(categories: StaffServiceCategory[]): Choices {
  return Object.fromEntries(
    categories.flatMap((category) =>
      category.services.map((service) => [
        service.id,
        {
          assigned: service.assigned,
          duration: service.ownDuration ? String(service.ownDuration) : "",
        },
      ]),
    ),
  );
}

function durationError(choice: Choice): string | null {
  if (!choice.assigned || choice.duration === "") return null;
  const minutes = Number(choice.duration);
  return Number.isInteger(minutes) && minutes >= 5 && minutes <= 600
    ? null
    : DURATION_RANGE;
}

interface StaffServicesFormProps {
  staffId: string;
  categories: StaffServiceCategory[];
}

// Servicios de un profesional (US-013 y US-014, capturas 176 y 171): casillas por categoría y, en
// cada servicio marcado, cuánto se demora con él; vacío usa la duración del servicio.
export function StaffServicesForm({
  staffId,
  categories,
}: StaffServicesFormProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [initial] = useState(() => initialChoices(categories));
  const [choices, setChoices] = useState(initial);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useActionTransition();

  const dirty = JSON.stringify(choices) !== JSON.stringify(initial);
  const hasErrors = Object.values(choices).some(durationError);

  const update = (serviceId: string, change: Partial<Choice>) =>
    setChoices((current) => ({
      ...current,
      [serviceId]: { ...current[serviceId], ...change },
    }));

  const save = () => {
    startTransition(async () => {
      const result = await saveStaffServices({
        staffId,
        services: Object.entries(choices)
          .filter(([, choice]) => choice.assigned)
          .map(([serviceId, choice]) => ({
            serviceId,
            durationMinutes:
              choice.duration === "" ? null : Number(choice.duration),
          })),
      });
      if (!result.ok) {
        setFormError(result.error.message);
        return;
      }
      setFormError(null);
      toast.success("Servicios guardados");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {categories.map((category) => {
        const total = category.services.filter(
          (service) => choices[service.id].assigned,
        ).length;
        return (
          <details key={category.id} open className="group">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 border-b border-stroke text-18 font-bold text-primary [&::-webkit-details-marker]:hidden">
              <ChevronDown className="size-5 transition-transform duration-120 group-open:rotate-180" />
              {category.name}
              <span className="ml-auto text-14 font-medium text-slate">
                {total} de {category.services.length}
              </span>
            </summary>
            <ul className="divide-y divide-line">
              {category.services.map((service) => {
                const choice = choices[service.id];
                const error = durationError(choice);
                const checkId = `servicio-${service.id}`;
                const durationId = `duracion-${service.id}`;
                return (
                  <li key={service.id} className="flex flex-col gap-1 py-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={checkId}
                        checked={choice.assigned}
                        onCheckedChange={(checked) =>
                          update(service.id, { assigned: checked === true })
                        }
                        className="size-6 rounded-[6px]"
                      />
                      <label
                        htmlFor={checkId}
                        className="flex min-w-0 flex-1 cursor-pointer flex-col"
                      >
                        <span className="text-16 text-ink">{service.name}</span>
                        <span className="text-12 text-slate">
                          Duración del servicio:{" "}
                          {formatMinutes(service.durationMinutes)}
                        </span>
                      </label>
                      {choice.assigned && (
                        <div className="flex items-center gap-2">
                          <Input
                            id={durationId}
                            value={choice.duration}
                            readOnly={!hydrated}
                            onChange={(event) =>
                              update(service.id, {
                                duration: event.target.value.replace(/\D/g, ""),
                              })
                            }
                            inputMode="numeric"
                            maxLength={3}
                            placeholder={String(service.durationMinutes)}
                            aria-label={`Duración de ${service.name} con este profesional, en minutos`}
                            aria-invalid={error ? true : undefined}
                            className="h-11 w-[72px] px-3 text-center placeholder:text-stroke"
                          />
                          <span className="text-14 text-slate">min</span>
                        </div>
                      )}
                    </div>
                    {error && (
                      <p role="alert" className="pl-9 text-14 text-danger">
                        {service.name}: {error}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}

      {formError && (
        <p role="alert" className="text-14 text-danger">
          {formError}
        </p>
      )}
      <Button
        type="button"
        onClick={save}
        disabled={!hydrated || !dirty || hasErrors || pending}
        className="mt-2 w-full self-center md:w-[320px]"
      >
        {pending && <LoaderCircle className="animate-spin" />}
        {pending ? "Guardando…" : "Guardar servicios"}
      </Button>
    </div>
  );
}
