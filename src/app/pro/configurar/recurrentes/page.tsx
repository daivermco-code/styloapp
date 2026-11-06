import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { RecurringList } from "@/features/agenda/components/recurring-list";
import { getRecurringSeries } from "@/features/agenda/services/recurring-queries";
import { requireOwner } from "@/features/business/services/queries";
import { Fab } from "@/shared/components/fab";
import { TopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Agendas recurrentes" };

// Agendas recurrentes (T-10.2.2, US-050, pantalla 17, captura 72). Solo el dueño, que es quien
// crea las series: el botón flotante abre el editor de reservas, donde está "Repetir esta cita".
export default async function RecurringPage() {
  const owner = await requireOwner("/pro/configurar/recurrentes");
  const series = await getRecurringSeries(owner.business.id);
  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title="Agendas recurrentes" backHref="/pro/configurar" />
      <main className="mx-auto flex max-w-[720px] flex-col gap-5 px-5 pb-28 pt-5 md:px-6">
        <p className="text-center text-14 text-slate">
          Una serie repite la misma cita cada semana, cada 15 días o cada mes,
          el mismo día y a la misma hora, para tus clientes de siempre. Créala
          al agendar una cita, con &quot;Repetir esta cita&quot;.
        </p>
        <RecurringList series={series} />
      </main>
      <Fab
        href="/pro/agenda/nueva"
        label="Agendar una cita"
        icon={<CalendarDays />}
      />
    </div>
  );
}
