import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { RecurringFrequency } from "../lib/recurring";

// Agendas recurrentes (T-10.2.2, US-050). El equipo puede leer las series, pero la pantalla es
// solo del dueño (requireOwner), que es el único que las crea y las borra.

export interface RecurringSeries {
  id: string;
  clientName: string;
  serviceName: string;
  staffName: string;
  frequency: RecurringFrequency;
  weekday: number;
  startTime: string;
  startsOn: string;
  /** Las citas pendientes que todavía no empiezan. */
  left: number;
}

/** Las series del negocio, la más nueva primero, con cuántas citas les quedan. */
export async function getRecurringSeries(
  businessId: string,
  now: Date = new Date(),
): Promise<RecurringSeries[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_bookings")
    .select(
      "id, frequency, weekday, start_time, starts_on, clients(full_name), services(name), staff(display_name), bookings(status, starts_at)",
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) {
    console.error("[getRecurringSeries]", error.code);
    throw new Error("No se pudieron cargar las agendas recurrentes.");
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    clientName: row.clients?.full_name ?? "",
    serviceName: row.services?.name ?? "",
    staffName: row.staff?.display_name ?? "",
    frequency: row.frequency,
    weekday: row.weekday,
    startTime: row.start_time,
    startsOn: row.starts_on,
    left: row.bookings.filter(
      (booking) =>
        booking.status === "pending" &&
        Date.parse(booking.starts_at) > now.getTime(),
    ).length,
  }));
}
