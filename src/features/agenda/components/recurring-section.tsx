"use client";

import { Check, LoaderCircle, Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import type { SheetChoice } from "@/features/booking/components/booking-sheet";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { formatShortDate } from "@/shared/lib/dates";
import { formatClock } from "../lib/hours";
import type { RecurringFrequency, SeriesDateStatus } from "../lib/recurring";
import { previewRecurring } from "../services/recurring-actions";
import type { SeriesDate } from "../types/agenda";

export interface RepeatPlan {
  frequency: RecurringFrequency;
  count: number;
}

const FREQUENCIES: { value: RecurringFrequency; label: string }[] = [
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "monthly", label: "Mensual" },
];

const REASON: Record<Exclude<SeriesDateStatus, "free">, string> = {
  busy: "hora ocupada",
  closed: "fuera de horario",
  past: "ya pasó",
};

export const DEFAULT_REPEAT: RepeatPlan = { frequency: "weekly", count: 10 };

const shortDate = (day: string) => formatShortDate(`${day}T12:00:00-05:00`);

interface RecurringSectionProps {
  /** Lo elegido en la hoja; null mientras falte el profesional o la hora. */
  choice: SheetChoice | null;
  value: RepeatPlan | null;
  onChange: (value: RepeatPlan | null) => void;
  /** Las fechas revisadas, o null mientras se revisan o si la serie está apagada. */
  onPreview: (dates: SeriesDate[] | null) => void;
}

// "Repetir esta cita" (T-4.3.2, US-022, Blueprint "Pantallas — Fase 4"): frecuencia, desde la
// fecha y la hora de la hoja, número de citas (1 a 52) y la lista de fechas, marcando las que no
// se pueden crear. Solo para el dueño, al crear una cita con cliente.
export function RecurringSection({
  choice,
  value,
  onChange,
  onPreview,
}: RecurringSectionProps) {
  const hydrated = useHydrated();
  const [dates, setDates] = useState<{
    key: string;
    list: SeriesDate[];
  } | null>(null);
  const previewRef = useRef(onPreview);
  useEffect(() => {
    previewRef.current = onPreview;
  });

  // La hoja arma `choice` en cada render: el efecto depende de sus valores, no del objeto.
  const staffId = choice?.staffId ?? null;
  const day = choice?.day ?? "";
  const time = choice?.time ?? "";
  const duration = choice?.durationMinutes ?? 0;
  const frequency = value?.frequency ?? null;
  const count = value?.count ?? 0;
  const key =
    staffId && frequency
      ? `${staffId}|${day}|${time}|${duration}|${frequency}|${count}`
      : null;
  const ready = dates !== null && dates.key === key;

  useEffect(() => {
    previewRef.current(null);
    if (!key || !staffId || !frequency) return;
    let active = true;
    void previewRecurring({
      staffId,
      day,
      time,
      durationMinutes: duration,
      frequency,
      count,
    }).then((result) => {
      if (!active) return;
      if (!result.ok) toast.error(result.error.message);
      const list = result.ok ? result.data : [];
      setDates({ key, list });
      previewRef.current(list);
    });
    return () => {
      active = false;
    };
  }, [key, staffId, day, time, duration, frequency, count]);

  const setCount = (count: number) =>
    value && onChange({ ...value, count: Math.min(52, Math.max(1, count)) });

  return (
    <div className="flex flex-col gap-4 px-5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="repeat" className="text-16 font-bold text-ink">
          Repetir esta cita
        </label>
        <Switch
          id="repeat"
          checked={value !== null}
          onCheckedChange={(on) => onChange(on ? DEFAULT_REPEAT : null)}
        />
      </div>
      {value && (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-14 font-bold text-ink">Frecuencia</p>
            <div role="group" aria-label="Frecuencia" className="flex gap-2">
              {FREQUENCIES.map((option) => {
                const selected = option.value === value.frequency;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    disabled={!hydrated}
                    onClick={() =>
                      onChange({ ...value, frequency: option.value })
                    }
                    className={cn(
                      "h-11 flex-1 rounded-full border text-14 transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                      selected
                        ? "border-primary bg-primary font-bold text-surface"
                        : "border-line text-primary hover:bg-primary-50",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-14 text-ink">
            Desde{" "}
            <span className="font-bold">
              {choice
                ? `${shortDate(choice.day)} · ${formatClock(choice.time)}`
                : "la fecha y la hora que elijas"}
            </span>
          </p>
          <div className="flex items-center justify-between gap-3">
            <span id="repeat-count" className="text-14 font-bold text-ink">
              Número de citas
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Una cita menos"
                disabled={!hydrated || value.count <= 1}
                onClick={() => setCount(value.count - 1)}
                className="flex size-11 items-center justify-center rounded-full border border-line text-primary disabled:cursor-default disabled:opacity-50"
              >
                <Minus className="size-5" aria-hidden />
              </button>
              <span
                aria-labelledby="repeat-count"
                aria-live="polite"
                className="w-8 text-center text-18 font-bold text-ink"
              >
                {value.count}
              </span>
              <button
                type="button"
                aria-label="Una cita más"
                disabled={!hydrated || value.count >= 52}
                onClick={() => setCount(value.count + 1)}
                className="flex size-11 items-center justify-center rounded-full border border-line text-primary disabled:cursor-default disabled:opacity-50"
              >
                <Plus className="size-5" aria-hidden />
              </button>
            </div>
          </div>
          {!choice ? (
            <p className="text-14 text-slate">
              Elige la hora para ver las fechas.
            </p>
          ) : !ready ? (
            <p
              role="status"
              className="flex items-center gap-2 text-14 text-slate"
            >
              <LoaderCircle className="size-5 animate-spin text-primary" />
              Revisando las fechas…
            </p>
          ) : (
            <ul
              aria-label="Fechas de la serie"
              className="flex flex-col border-t border-line"
            >
              {dates.list.map((item) => (
                <li
                  key={item.day}
                  className="flex min-h-11 items-center gap-3 border-b border-line text-14"
                >
                  {item.status === "free" ? (
                    <Check
                      className="size-5 shrink-0 text-success"
                      aria-hidden
                    />
                  ) : (
                    <X className="size-5 shrink-0 text-danger" aria-hidden />
                  )}
                  <span
                    className={cn(
                      "first-letter:uppercase",
                      item.status === "free" ? "text-ink" : "text-slate",
                    )}
                  >
                    {shortDate(item.day)}
                    {item.status !== "free" && ` · ${REASON[item.status]}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
