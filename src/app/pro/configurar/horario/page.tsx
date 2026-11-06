import type { Metadata } from "next";
import { WeekHoursEditor } from "@/features/business/components/week-hours-editor";
import {
  getWeekHours,
  requireOwner,
} from "@/features/business/services/queries";
import { TopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Horario del negocio" };

// Horario del negocio (T-2.2.3, US-009, captura 67). Las horas de cada profesional salen del
// cruce con este horario (effectiveRanges).
export default async function BusinessHoursPage() {
  const owner = await requireOwner("/pro/configurar/horario");
  const week = await getWeekHours(owner.business.id, null);

  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title="Horario del negocio" backHref="/pro/configurar" />
      <main className="mx-auto max-w-[720px] px-5 pb-24 pt-2 md:px-6">
        <p className="pt-3 text-14 text-slate">
          Para la hora de almuerzo, parte el día en dos franjas: por ejemplo, de
          9:00 a. m. a 1:00 p. m. y de 2:00 p. m. a 7:00 p. m.
        </p>
        {/* key: después de guardar, el editor arranca de lo guardado. */}
        <WeekHoursEditor
          key={JSON.stringify(week)}
          staffId={null}
          initial={week}
        />
      </main>
    </div>
  );
}
