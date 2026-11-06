"use client";

import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { Switch } from "@/components/ui/switch";
import {
  clockOptions,
  findRangeError,
  fitsWithin,
  formatClock,
  nextRange,
  type TimeRange,
  toMinutes,
  WEEK_ORDER,
  type Weekday,
  WEEKDAY_NAMES,
  type WeekHours,
} from "@/features/agenda/lib/hours";
import { cn } from "@/lib/utils";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { saveWeekHours } from "../services/actions";

const CLOCKS = clockOptions();
// Los botones del editor esperan a React sin cambiar de color (Auto-Blindaje de la Fase 1).
const WAITING_REACT = "disabled:bg-transparent";
const DEFAULT_RANGE: TimeRange = { starts: "09:00", ends: "18:00" };

function sameWeek(a: WeekHours, b: WeekHours): boolean {
  const sorted = (week: WeekHours) =>
    WEEK_ORDER.map((day) =>
      [...week[day]].sort((x, y) => toMinutes(x.starts) - toMinutes(y.starts)),
    );
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}

interface TimeSelectProps {
  label: string;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}

function TimeSelect({ label, value, invalid, onChange }: TimeSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        aria-invalid={invalid ? true : undefined}
        className="h-11 w-[136px] px-3 focus:px-[11px] aria-[invalid]:border-danger"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {CLOCKS.map((clock) => (
          <SelectItem key={clock} value={clock}>
            {formatClock(clock)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface WeekHoursEditorProps {
  /** null = el horario del negocio; si no, el del profesional. */
  staffId: string | null;
  initial: WeekHours;
  /** Para un profesional: el horario del negocio y el texto si una franja se sale de él. */
  limits?: { week: WeekHours; message: string };
}

function rangesLabel(ranges: TimeRange[]): string {
  return ranges
    .map((range) => `${formatClock(range.starts)} a ${formatClock(range.ends)}`)
    .join(" y ");
}

// Editor de horario por día (T-2.2.3, US-009; lo reusan la ficha del profesional y "Configurar
// cuenta"): cada día con sus franjas desde–hasta, agregar y borrar; un día sin franjas está
// cerrado. "Guardar" guarda la semana entera y se activa con un cambio sin errores.
export function WeekHoursEditor({
  staffId,
  initial,
  limits,
}: WeekHoursEditorProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [week, setWeek] = useState(initial);
  // Lo que tenía un día al cerrarlo, para devolvérselo si se vuelve a abrir.
  const [closed, setClosed] = useState<Partial<WeekHours>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useActionTransition();

  const errors = Object.fromEntries(
    WEEK_ORDER.map((day) => [
      day,
      findRangeError(week[day]) ??
        (limits && !fitsWithin(week[day], limits.week[day])
          ? limits.message
          : null),
    ]),
  ) as Record<Weekday, string | null>;
  const hasErrors = WEEK_ORDER.some((day) => errors[day]);
  const dirty = !sameWeek(week, initial);

  const setDay = (day: Weekday, ranges: TimeRange[]) =>
    setWeek((current) => ({ ...current, [day]: ranges }));

  const toggleDay = (day: Weekday, open: boolean) => {
    if (!open) {
      setClosed((current) => ({ ...current, [day]: week[day] }));
      setDay(day, []);
      return;
    }
    // Lo que tenía, o el horario del negocio ese día, o el de otro día abierto.
    const remembered = closed[day];
    const business = limits?.week[day];
    const neighbor = WEEK_ORDER.map((other) => week[other]).find(
      (ranges) => ranges.length > 0,
    );
    setDay(
      day,
      remembered?.length
        ? remembered
        : business?.length
          ? business
          : (neighbor ?? [DEFAULT_RANGE]),
    );
  };

  const updateRange = (
    day: Weekday,
    index: number,
    key: keyof TimeRange,
    value: string,
  ) =>
    setDay(
      day,
      week[day].map((range, position) =>
        position === index ? { ...range, [key]: value } : range,
      ),
    );

  const save = () => {
    startTransition(async () => {
      const result = await saveWeekHours({
        staffId,
        days: WEEK_ORDER.map((day) => ({ weekday: day, ranges: week[day] })),
      });
      if (!result.ok) {
        const day = result.error.field;
        setFormError(
          day
            ? `${WEEKDAY_NAMES[Number(day) as Weekday]}: ${result.error.message}`
            : result.error.message,
        );
        return;
      }
      setFormError(null);
      toast.success("Horario guardado");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col">
      <ul className="divide-y divide-line">
        {WEEK_ORDER.map((day) => {
          const name = WEEKDAY_NAMES[day];
          const ranges = week[day];
          const open = ranges.length > 0;
          const error = errors[day];
          const business = limits?.week[day];
          const businessClosed = business?.length === 0;
          return (
            <li
              key={day}
              role="group"
              aria-labelledby={`dia-${day}`}
              className="flex flex-col gap-3 py-4"
            >
              <div className="flex min-h-11 items-center justify-between gap-4">
                <div className="flex flex-col">
                  <h2 id={`dia-${day}`} className="text-16 font-bold text-ink">
                    {name}
                  </h2>
                  {business && (
                    <p className="text-12 text-slate">
                      {businessClosed
                        ? "El negocio no abre este día"
                        : `Negocio: ${rangesLabel(business)}`}
                    </p>
                  )}
                </div>
                <label className="flex items-center gap-3 text-14 text-slate">
                  {open ? "Abierto" : "Cerrado"}
                  <Switch
                    checked={open}
                    onCheckedChange={(checked) => toggleDay(day, checked)}
                    disabled={businessClosed && !open}
                    aria-label={`${name}: abierto`}
                  />
                </label>
              </div>
              {ranges.map((range, index) => (
                <div
                  key={`${day}-${index}`}
                  className="flex items-center gap-2"
                >
                  <TimeSelect
                    label={`${name}, franja ${index + 1}: desde`}
                    value={range.starts}
                    invalid={!!error}
                    onChange={(value) =>
                      updateRange(day, index, "starts", value)
                    }
                  />
                  <span aria-hidden="true" className="text-slate">
                    –
                  </span>
                  <TimeSelect
                    label={`${name}, franja ${index + 1}: hasta`}
                    value={range.ends}
                    invalid={!!error}
                    onChange={(value) => updateRange(day, index, "ends", value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Borrar la franja ${index + 1} del ${name.toLowerCase()}`}
                    onClick={() =>
                      setDay(
                        day,
                        ranges.filter((_, position) => position !== index),
                      )
                    }
                    disabled={!hydrated}
                    className={cn(
                      "ml-auto text-slate hover:text-danger md:ml-1",
                      !hydrated && `${WAITING_REACT} disabled:text-slate`,
                    )}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              {error && (
                <p role="alert" className="text-14 text-danger">
                  {error}
                </p>
              )}
              {open && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDay(day, [...ranges, nextRange(ranges)])}
                  disabled={!hydrated || ranges.length >= 6}
                  className={cn(
                    "self-start px-2",
                    !hydrated && `${WAITING_REACT} disabled:text-primary`,
                  )}
                >
                  <Plus />
                  Agregar franja
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {formError && (
        <p role="alert" className="pt-2 text-14 text-danger">
          {formError}
        </p>
      )}
      {hasErrors && (
        <p className="pt-2 text-center text-14 text-slate">
          Corrige las franjas marcadas para guardar.
        </p>
      )}
      <Button
        type="button"
        onClick={save}
        disabled={!hydrated || !dirty || hasErrors || pending}
        className="mt-4 w-full self-center md:w-[320px]"
      >
        {pending && <LoaderCircle className="animate-spin" />}
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </div>
  );
}
