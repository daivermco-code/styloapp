"use client";

import { Clock, LoaderCircle, X } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatClock } from "@/features/agenda/lib/hours";
import type {
  BookingServiceOption,
  BookingStaffOption,
} from "@/features/agenda/types/agenda";
import { MISSING_DATA, NO_FREE_HOURS } from "@/features/agenda/types/schemas";
import { cn } from "@/lib/utils";
import { DayStrip } from "@/shared/components/day-strip";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { formatMinutes } from "@/shared/lib/duration";
import { type ActionResult, AppErrorCode } from "@/shared/types/action-result";

export interface SheetChoice {
  staffId: string;
  day: string;
  time: string;
  durationMinutes: number;
  guestName: string | null;
}

interface HoursQuery {
  staffId: string;
  day: string;
  durationMinutes: number;
}

interface BookingSheetProps {
  service: BookingServiceOption;
  today: string;
  /** Lo que llega elegido: de la grilla (profesional, día y hora) o de la cita a modificar. */
  initial: {
    staffId: string | null;
    day: string;
    time: string | null;
    durationMinutes: number | null;
    guestName: string | null;
  };
  /** Pide el nombre de quien viene (Seguir sin cliente). */
  askGuestName: boolean;
  submitLabel: string;
  loadHours: (query: HoursQuery) => Promise<ActionResult<string[]>>;
  onSubmit: (choice: SheetChoice) => Promise<ActionResult<unknown>>;
  onRemoveService: () => void;
  onDayChange?: (day: string) => void;
  /** Algo más antes del botón (Repetir esta cita), con lo elegido o null si falta algo. */
  extra?: (choice: SheetChoice | null) => ReactNode;
  /** Apaga el botón aunque esté todo (la serie revisando sus fechas). */
  submitDisabled?: boolean;
  /** El cliente no cambia la duración (la pone la base), ve el precio y elige desde hoy (Fase 5). */
  forClient?: boolean;
  /** Al cambiar, vuelve a pedir las horas (la hora se ocupó en la verificación del cliente). */
  staleKey?: number;
  /** El texto del día sin horas; por defecto, el del negocio. */
  noHoursMessage?: string;
  /** El nombre de la X de arriba; al modificar como cliente cierra la hoja. */
  closeLabel?: string;
  /** En vez de la X, un botón con este texto ("Cambiar" en la página por enlace). */
  closeText?: string;
  /** El texto bajo el botón mientras falta algo; por defecto, "Faltan datos por completar". */
  missingMessage?: string;
  className?: string;
}

/** Duraciones para esta cita: cada 15 minutos hasta 4 horas, más la del servicio. */
function durationOptions(base: number): number[] {
  const options = new Set(
    Array.from({ length: 16 }, (_, index) => (index + 1) * 15),
  );
  options.add(base);
  return [...options].sort((a, b) => a - b);
}

function initialStaff(
  staff: BookingStaffOption[],
  wanted: string | null,
): BookingStaffOption | null {
  return (
    staff.find((option) => option.id === wanted) ??
    (staff.length === 1 ? staff[0] : null)
  );
}

// Hoja de reservar (T-3.4.2, UI pantalla 3, capturas 05 y 08): el servicio con su duración, quién
// lo hace, la fecha, la duración para esta cita, la fila de horas libres y el botón, que queda
// apagado con "Faltan datos por completar" hasta tener todo. La comparte la reserva del cliente
// (Fase 5, `forClient`): sin la duración y con el precio. Si alguien toma la hora mientras tanto
// o ya no se puede, avisa y vuelve a pedir la fila.
export function BookingSheet({
  service,
  today,
  initial,
  askGuestName,
  submitLabel,
  loadHours,
  onSubmit,
  onRemoveService,
  onDayChange,
  extra,
  submitDisabled = false,
  forClient = false,
  staleKey = 0,
  noHoursMessage = NO_FREE_HOURS,
  closeLabel = "Quitar el servicio",
  closeText,
  missingMessage = MISSING_DATA,
  className,
}: BookingSheetProps) {
  const hydrated = useHydrated();
  const first = initialStaff(service.staff, initial.staffId);
  const [staffId, setStaffId] = useState(first?.id ?? null);
  const [day, setDay] = useState(initial.day);
  const [time, setTime] = useState(initial.time);
  const [duration, setDuration] = useState(
    initial.durationMinutes ??
      first?.durationMinutes ??
      service.durationMinutes,
  );
  const [guestName, setGuestName] = useState(initial.guestName ?? "");
  const [reload, setReload] = useState(0);
  const [hours, setHours] = useState<{ key: string; slots: string[] } | null>(
    null,
  );
  const [pending, startTransition] = useActionTransition();

  // La función puede cambiar en cada render del padre: se lee de un ref para no pedir de más.
  const loadRef = useRef(loadHours);
  useEffect(() => {
    loadRef.current = loadHours;
  });

  const key = `${staffId}|${day}|${duration}|${reload}|${staleKey}`;
  useEffect(() => {
    if (!staffId) return;
    let active = true;
    void loadRef
      .current({ staffId, day, durationMinutes: duration })
      .then((result) => {
        if (!active) return;
        if (!result.ok) toast.error(result.error.message);
        setHours({ key, slots: result.ok ? result.data : [] });
      });
    return () => {
      active = false;
    };
  }, [key, staffId, day, duration]);

  const loading = staffId !== null && hours?.key !== key;
  const slots = !loading && hours ? hours.slots : [];
  const chosenTime = time && slots.includes(time) ? time : null;
  // La hora que llega elegida (al modificar o al volver de entrar) puede quedar al final de la fila.
  const hoursRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    hoursRef.current
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [hours]);
  const missing =
    !staffId || !chosenTime || (askGuestName && guestName.trim().length < 2);
  const choice: SheetChoice | null =
    staffId && chosenTime
      ? {
          staffId,
          day,
          time: chosenTime,
          durationMinutes: duration,
          guestName: askGuestName ? guestName.trim() : null,
        }
      : null;

  const chooseStaff = (option: BookingStaffOption) => {
    setStaffId(option.id);
    setDuration(option.durationMinutes);
  };
  const chooseDay = (next: string) => {
    setDay(next);
    onDayChange?.(next);
  };
  const submit = () => {
    if (!choice) return;
    startTransition(async () => {
      const result = await onSubmit(choice);
      if (result.ok) return;
      toast.error(result.error.message);
      if (
        result.error.code === AppErrorCode.SLOT_TAKEN ||
        result.error.code === AppErrorCode.OUTSIDE_HOURS
      ) {
        setTime(null);
        setReload((value) => value + 1);
      }
    });
  };

  return (
    <section
      aria-label="Reservar"
      className={cn("flex flex-col gap-5 bg-surface pb-6", className)}
    >
      <div className="flex items-start gap-3 border-b border-line px-5 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-16 font-bold text-ink">
            {service.name}
          </h2>
          <p className="text-14 text-slate">{formatMinutes(duration)} aprox.</p>
        </div>
        {forClient && (
          <p className="pt-0.5 text-16 font-bold text-ink">
            {service.priceLabel}
          </p>
        )}
        {closeText ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!hydrated}
            onClick={onRemoveService}
            className="min-h-11 shrink-0"
          >
            {closeText}
          </Button>
        ) : (
          <button
            type="button"
            aria-label={closeLabel}
            disabled={!hydrated}
            onClick={onRemoveService}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-surface hover:bg-primary-700 disabled:cursor-default"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <div
        role="group"
        aria-label="Profesional"
        className="flex gap-4 overflow-x-auto px-5 [scrollbar-width:none]"
      >
        {service.staff.map((option) => {
          const selected = option.id === staffId;
          return (
            <button
              key={option.id}
              type="button"
              disabled={!hydrated}
              aria-pressed={selected}
              onClick={() => chooseStaff(option)}
              className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-card py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-16 items-center justify-center rounded-full bg-primary text-25 font-bold text-surface ring-offset-2 transition-shadow duration-120",
                  selected && "ring-4 ring-secondary",
                )}
              >
                {option.name.charAt(0).toUpperCase()}
              </span>
              <span
                className={cn(
                  "max-w-full truncate text-14",
                  selected ? "font-bold text-primary" : "text-ink",
                )}
              >
                {option.name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <p className="px-5 text-14 font-bold text-ink">Selecciona la fecha</p>
        <DayStrip
          selected={day}
          today={today}
          onSelect={chooseDay}
          minDay={forClient ? today : undefined}
        />
      </div>

      {!forClient && (
        <div className="flex items-center justify-center gap-3 px-5 text-16 text-ink">
          <span>Duración del servicio</span>
          <Select
            value={String(duration)}
            onValueChange={(value) => setDuration(Number(value))}
          >
            <SelectTrigger
              aria-label="Duración para esta cita"
              className="h-11 w-auto gap-2 border-0 bg-transparent px-1 text-16 font-bold text-ink underline underline-offset-4 focus:border-0 focus:px-1 focus:ring-2 focus:ring-ring [&>svg:last-child]:hidden"
            >
              <SelectValue />
              <Clock className="size-5 text-slate" aria-hidden />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {durationOptions(service.durationMinutes).map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>
                  {formatMinutes(minutes)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex min-h-12 flex-col justify-center">
        {!staffId ? (
          <p className="px-5 text-center text-14 text-slate">
            Elige quién te atiende para ver las horas.
          </p>
        ) : loading ? (
          <p
            role="status"
            className="flex items-center justify-center gap-2 text-14 text-slate"
          >
            <LoaderCircle className="size-5 animate-spin text-primary" />
            Buscando horas libres…
          </p>
        ) : slots.length === 0 ? (
          <p role="status" className="px-5 text-center text-14 text-slate">
            {noHoursMessage}
          </p>
        ) : (
          <div
            ref={hoursRef}
            role="group"
            aria-label="Horas libres"
            className="flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]"
          >
            {slots.map((slot) => {
              const selected = slot === chosenTime;
              return (
                <button
                  key={slot}
                  type="button"
                  aria-pressed={selected}
                  disabled={!hydrated}
                  onClick={() => setTime(slot)}
                  className={cn(
                    "h-11 shrink-0 rounded-full px-4 text-16 transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                    selected
                      ? "bg-primary font-bold text-surface"
                      : "text-primary hover:bg-primary-50",
                  )}
                >
                  {formatClock(slot)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {askGuestName && (
        <div className="flex flex-col gap-2 px-5">
          <label htmlFor="guestName" className="text-14 font-bold text-ink">
            Nombre del cliente <span aria-hidden="true">*</span>
          </label>
          <Input
            id="guestName"
            value={guestName}
            maxLength={80}
            autoComplete="off"
            onChange={(event) => setGuestName(event.target.value)}
            placeholder="¿A nombre de quién?"
          />
        </div>
      )}

      {extra?.(choice)}

      <div className="flex flex-col items-center gap-2 px-5">
        <Button
          type="button"
          onClick={submit}
          disabled={!hydrated || missing || pending || submitDisabled}
          className="w-full max-w-sm"
        >
          {pending && <LoaderCircle className="animate-spin" />}
          {submitLabel}
        </Button>
        {missing && (
          <p className="text-14 text-slate" aria-live="polite">
            {missingMessage}
          </p>
        )}
      </div>
    </section>
  );
}
