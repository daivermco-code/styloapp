"use client";

import { Frown, LoaderCircle, type LucideIcon, Meh, Smile } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { markPunctuality } from "../services/actions";
import { PUNCTUALITY } from "../types/schemas";

interface Face {
  value: 5 | 3 | 1;
  label: string;
  icon: LucideIcon;
  className: string;
}

const FACES: Face[] = [
  {
    value: PUNCTUALITY.onTime,
    label: "A tiempo",
    icon: Smile,
    className: "text-success",
  },
  {
    value: PUNCTUALITY.late,
    label: "Tarde",
    icon: Meh,
    className: "text-warning",
  },
  {
    value: PUNCTUALITY.noShow,
    label: "No llegó",
    icon: Frown,
    className: "text-danger",
  },
];

interface PunctualityPickerProps {
  bookingId: string;
  /** La marca que ya tiene, o null. */
  value: number | null;
  /** Sin "¿Cómo llegó el cliente?" encima, cuando la pantalla ya lo pregunta (liquidador). */
  showQuestion?: boolean;
  /** El nombre del grupo de caritas; en una lista de citas, el de esa cita (liquidador). */
  groupLabel?: string;
}

// La pregunta de la llegada (T-3.5.2, US-019): tres caritas de 48 px desde que empieza la cita.
// Ya marcada, muestra la elegida con Editar.
export function PunctualityPicker({
  bookingId,
  value,
  showQuestion = true,
  groupLabel = "Llegada del cliente",
}: PunctualityPickerProps) {
  const hydrated = useHydrated();
  const [editing, setEditing] = useState(value === null);
  const [pending, startTransition] = useActionTransition();
  const chosen = FACES.find((face) => face.value === value);

  const mark = (face: Face) => {
    startTransition(async () => {
      const result = await markPunctuality({
        bookingId,
        punctuality: face.value,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setEditing(false);
      toast.success(`Llegada marcada: ${face.label.toLowerCase()}`);
    });
  };

  if (!editing && chosen) {
    return (
      <div className="flex flex-col items-center gap-2">
        {showQuestion && (
          <p className="text-16 font-bold text-ink">¿Cómo llegó el cliente?</p>
        )}
        <div className="flex items-center gap-3">
          <chosen.icon
            aria-hidden
            className={cn("size-12", chosen.className)}
            strokeWidth={1.6}
          />
          <span className="text-16 font-bold text-ink">{chosen.label}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!hydrated}
            onClick={() => setEditing(true)}
          >
            Editar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {showQuestion && (
        <p className="text-16 font-bold text-ink">¿Cómo llegó el cliente?</p>
      )}
      <div role="group" aria-label={groupLabel} className="flex gap-4">
        {FACES.map((face) => (
          <button
            key={face.value}
            type="button"
            disabled={!hydrated || pending}
            aria-pressed={face.value === value}
            onClick={() => mark(face)}
            className={cn(
              "flex w-20 flex-col items-center gap-1 rounded-card py-2 text-14 text-ink transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
              face.value === value && "bg-primary-50 font-bold",
            )}
          >
            <face.icon
              aria-hidden
              className={cn("size-12", face.className)}
              strokeWidth={1.6}
            />
            {face.label}
          </button>
        ))}
      </div>
      {pending && (
        <LoaderCircle
          aria-label="Guardando"
          className="size-5 animate-spin text-primary"
        />
      )}
    </div>
  );
}
