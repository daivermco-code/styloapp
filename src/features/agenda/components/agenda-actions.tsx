"use client";

import { CalendarDays, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Fab } from "@/shared/components/fab";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { NO_BOOKING_PERMISSION } from "../types/messages";

// Recargar la agenda (barra superior): vuelve a pedir el día al servidor.
export function RefreshAgendaButton() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label="Recargar la agenda"
      disabled={!hydrated || pending}
      onClick={() => startTransition(() => router.refresh())}
      className="flex h-11 w-11 items-center justify-center rounded-full text-primary hover:bg-primary-50 disabled:cursor-default"
    >
      <RotateCw className={cn("size-6", pending && "animate-spin")} />
    </button>
  );
}

interface NewBookingFabProps {
  /** El editor abre en este día. */
  day: string;
  /** El profesional agenda en su columna. */
  staffId: string | null;
  canBook: boolean;
}

// Botón flotante de la agenda (captura 03): abre el editor de reservas; sin el permiso de
// agendar, avisa (US-016).
export function NewBookingFab({ day, staffId, canBook }: NewBookingFabProps) {
  const params = new URLSearchParams({ dia: day });
  if (staffId) params.set("profesional", staffId);
  if (!canBook) {
    return (
      <Fab
        label="Agendar una cita"
        icon={<CalendarDays />}
        onClick={() => toast.error(NO_BOOKING_PERMISSION)}
      />
    );
  }
  return (
    <Fab
      label="Agendar una cita"
      icon={<CalendarDays />}
      href={`/pro/agenda/nueva?${params}`}
    />
  );
}
