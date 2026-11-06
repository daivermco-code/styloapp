"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  BookingSheet,
  type SheetChoice,
} from "@/features/booking/components/booking-sheet";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import {
  createBooking,
  loadFreeHours,
  updateBooking,
} from "../services/actions";
import { createRecurring } from "../services/recurring-actions";
import type {
  AgendaClient,
  BookingCategoryOption,
  BookingServiceOption,
  EditableBooking,
  SeriesDate,
} from "../types/agenda";
import { ClientPicker } from "./client-picker";
import { RecurringSection, type RepeatPlan } from "./recurring-section";
import { ServicePicker } from "./service-picker";

// Desde 1024 px la agenda se ve al lado del editor y sigue el día elegido.
const SIDE_BY_SIDE = "(min-width: 1024px)";

type ClientChoice =
  { kind: "client"; id: string; fullName: string } | { kind: "guest" };

interface BookingEditorProps {
  today: string;
  categories: BookingCategoryOption[];
  clients: AgendaClient[];
  canCreateClients: boolean;
  /** "Repetir esta cita" (US-022): solo el dueño. */
  canRepeat: boolean;
  /** Lo que trae la URL desde la grilla: día, profesional y hora. */
  prefill: { day: string; staffId: string | null; time: string | null };
  /** Modificar: la cita cargada (el cliente no cambia). */
  editing: EditableBooking | null;
}

function findService(
  categories: BookingCategoryOption[],
  id: string | undefined,
): BookingServiceOption | null {
  for (const category of categories) {
    const service = category.services.find((item) => item.id === id);
    if (service) return service;
  }
  return null;
}

/** "Crear 9 de 10 citas", o "Crear 10 citas" si todas se pueden. */
function seriesLabel(dates: SeriesDate[]): string {
  const free = dates.filter((item) => item.status === "free").length;
  if (free < dates.length) return `Crear ${free} de ${dates.length} citas`;
  return free === 1 ? "Crear 1 cita" : `Crear ${free} citas`;
}

// Editor de reservas (T-3.4.1 y T-3.4.2, US-017 y US-018): cliente, servicio y la hoja de
// reservar. En el celular la hoja sube sobre la lista de servicios; en computador todo va en el
// panel de la derecha.
export function BookingEditor({
  today,
  categories,
  clients,
  canCreateClients,
  canRepeat,
  prefill,
  editing,
}: BookingEditorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const [client, setClient] = useState<ClientChoice | null>(() => {
    if (!editing) return null;
    return editing.clientId
      ? { kind: "client", id: editing.clientId, fullName: editing.clientName }
      : { kind: "guest" };
  });
  const [service, setService] = useState(() =>
    findService(categories, editing?.serviceId),
  );
  const [repeat, setRepeat] = useState<RepeatPlan | null>(null);
  const [series, setSeries] = useState<SeriesDate[] | null>(null);
  // La serie va con una ficha de cliente y solo al crear.
  const canSeries = canRepeat && !editing && client?.kind === "client";
  const repeating = canSeries && repeat !== null;

  const followDay = (day: string) => {
    if (!window.matchMedia(SIDE_BY_SIDE).matches) return;
    const params = new URLSearchParams(searchParams);
    params.set("dia", day);
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  const submit = async (choice: SheetChoice) => {
    if (!service || !client) return { ok: true as const, data: null };
    const fields = { ...choice, serviceId: service.id };
    if (repeating && repeat && client.kind === "client") {
      const result = await createRecurring({
        ...fields,
        clientId: client.id,
        frequency: repeat.frequency,
        count: repeat.count,
      });
      if (result.ok) {
        toast.success(result.data.message);
        router.push(`/pro/agenda?dia=${choice.day}`);
      }
      return result;
    }
    const result = editing
      ? await updateBooking({
          ...fields,
          bookingId: editing.id,
          guestName: client.kind === "guest" ? choice.guestName : null,
        })
      : await createBooking({
          ...fields,
          clientId: client.kind === "client" ? client.id : null,
        });
    if (result.ok) {
      toast.success(editing ? "Cita modificada" : "Cita agendada");
      router.push(`/pro/agenda?dia=${choice.day}`);
    }
    return result;
  };

  if (!client) {
    return (
      <ClientPicker
        clients={clients}
        canCreate={canCreateClients}
        onPick={(picked) =>
          setClient({
            kind: "client",
            id: picked.id,
            fullName: picked.fullName,
          })
        }
        onSkip={() => setClient({ kind: "guest" })}
      />
    );
  }

  return (
    <>
      <div className={cn("flex flex-col", service && "lg:hidden")}>
        <div className="flex flex-col gap-1 px-5 pb-2 pt-5">
          <h2 className="text-20 font-bold text-primary">Elige el servicio</h2>
          <p className="flex flex-wrap items-center gap-x-2 text-14 text-slate">
            {client.kind === "client"
              ? `Cliente: ${client.fullName}`
              : "Sin cliente: el nombre se pide al final."}
            {!editing && (
              <button
                type="button"
                disabled={!hydrated}
                onClick={() => {
                  setClient(null);
                  setService(null);
                }}
                className="min-h-11 font-bold text-primary underline-offset-4 hover:underline disabled:cursor-default"
              >
                Cambiar
              </button>
            )}
          </p>
        </div>
        <ServicePicker
          categories={categories}
          selectedId={service?.id ?? null}
          onPick={setService}
        />
        {/* Deja ver el final de la lista por encima de la hoja. */}
        {service && <div aria-hidden className="h-[60dvh] lg:hidden" />}
      </div>

      {service && (
        <BookingSheet
          key={service.id}
          service={service}
          today={today}
          initial={{
            staffId: editing?.staffId ?? prefill.staffId,
            day: editing?.day ?? prefill.day,
            time: editing?.time ?? prefill.time,
            durationMinutes:
              editing?.serviceId === service.id
                ? editing.durationMinutes
                : null,
            guestName: editing?.guestName ?? null,
          }}
          askGuestName={client.kind === "guest"}
          submitLabel={
            editing
              ? "Modificar cita"
              : repeating
                ? series
                  ? seriesLabel(series)
                  : "Crear citas"
                : "Crear cita"
          }
          loadHours={(query) =>
            loadFreeHours({ ...query, exceptId: editing?.id ?? null })
          }
          onSubmit={submit}
          onRemoveService={() => setService(null)}
          onDayChange={followDay}
          extra={
            canSeries
              ? (choice) => (
                  <RecurringSection
                    choice={choice}
                    value={repeat}
                    onChange={setRepeat}
                    onPreview={setSeries}
                  />
                )
              : undefined
          }
          submitDisabled={
            repeating && !series?.some((item) => item.status === "free")
          }
          className="fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] overflow-y-auto rounded-t-sheet pb-24 lg:pb-6 shadow-sheet lg:static lg:max-h-none lg:rounded-none lg:shadow-none"
        />
      )}
    </>
  );
}
