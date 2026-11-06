import { CircleAlert } from "lucide-react";
import {
  OUTSIDE_BUSINESS,
  OUTSIDE_BUSINESS_SELF,
  WEEK_ORDER,
} from "@/features/agenda/lib/hours";
import { WeekHoursEditor } from "@/features/business/components/week-hours-editor";
import { getWeekHours } from "@/features/business/services/queries";
import { EmptyState } from "@/shared/components/empty-state";
import { PillTabs } from "@/shared/components/pill-tabs";
import { getStaffPricing, getStaffServiceOptions } from "../services/queries";
import { StaffPricing } from "./staff-pricing";
import { StaffServicesForm } from "./staff-services-form";
import { PendingArea } from "@/shared/components/instant-nav";
import { RowsSkeleton } from "@/shared/components/page-skeleton";
import { NAV_GROUP } from "@/shared/lib/instant-nav";

export const STAFF_TABS = ["horario", "servicios", "precio"] as const;
export type StaffTab = (typeof STAFF_TABS)[number];

export function toStaffTab(value: string | undefined): StaffTab {
  return STAFF_TABS.find((tab) => tab === value) ?? "horario";
}

const TAB_LABELS: Record<StaffTab, string> = {
  horario: "Horario",
  servicios: "Servicios",
  precio: "Precio y comisión",
};

interface StaffSettingsProps {
  businessId: string;
  staffId: string;
  name: string;
  tab: StaffTab;
  /** La ruta de la pantalla; la pestaña va en ?pestana=. */
  path: string;
  /** El mismo profesional (Configurar cuenta): sin la pestaña de precio y comisión. */
  self: boolean;
}

function missingText(hours: boolean, services: boolean): string {
  if (!hours && !services) return "horario y servicios";
  return hours ? "servicios" : "horario";
}

// Horario, servicios, y precio y comisión de un profesional (T-2.4.2, T-2.4.3 y T-7.3.1, US-013,
// US-014 y US-037). La usan la ficha del dueño y "Configurar cuenta" del profesional (sin precio
// ni comisión); el horario queda dentro del del negocio.
export async function StaffSettings({
  businessId,
  staffId,
  name,
  tab,
  path,
  self,
}: StaffSettingsProps) {
  const [week, businessWeek, categories, pricing] = await Promise.all([
    getWeekHours(businessId, staffId),
    getWeekHours(businessId, null),
    getStaffServiceOptions(businessId, staffId),
    self ? Promise.resolve([]) : getStaffPricing(businessId, staffId),
  ]);
  const hasHours = WEEK_ORDER.some((day) => week[day].length > 0);
  const hasServices = categories.some((category) =>
    category.services.some((service) => service.assigned),
  );
  const shown: readonly StaffTab[] = self
    ? STAFF_TABS.filter((id) => id !== "precio")
    : STAFF_TABS;
  const current = shown.includes(tab) ? tab : "horario";

  return (
    <div className="flex flex-col gap-4">
      {(!hasHours || !hasServices) && (
        <p className="flex items-start gap-2 rounded-card bg-warning/20 px-4 py-3 text-14 text-ink">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {self
            ? `Todavía no sales para reservar: te falta ${missingText(hasHours, hasServices)}.`
            : `${name} todavía no sale para reservar: le falta ${missingText(hasHours, hasServices)}.`}
        </p>
      )}
      <PillTabs
        label={self ? "Tu cuenta" : `Configuración de ${name}`}
        tabs={shown.map((id) => ({
          label: TAB_LABELS[id],
          href: id === "horario" ? path : `${path}?pestana=${id}`,
          selected: id === current,
        }))}
      />

      <PendingArea groups={[NAV_GROUP.tabs]} fallback={<RowsSkeleton />}>
        {current === "horario" && (
          <WeekHoursEditor
            key={JSON.stringify(week)}
            staffId={staffId}
            initial={week}
            limits={{
              week: businessWeek,
              message: self ? OUTSIDE_BUSINESS_SELF : OUTSIDE_BUSINESS,
            }}
          />
        )}
        {current === "servicios" &&
          (categories.length > 0 ? (
            <>
              <p className="text-14 text-slate">
                Marca lo que {self ? "haces" : "hace"} y, si{" "}
                {self ? "te demoras" : "se demora"} distinto, escribe los
                minutos. Vacío usa la duración del servicio.
              </p>
              <StaffServicesForm
                key={JSON.stringify(categories)}
                staffId={staffId}
                categories={categories}
              />
            </>
          ) : (
            <EmptyState
              message={
                self
                  ? "El negocio todavía no tiene servicios activos."
                  : "Todavía no tienes servicios activos. Créalos en Servicios."
              }
            />
          ))}
        {current === "precio" &&
          (pricing.length > 0 ? (
            <StaffPricing
              key={JSON.stringify(pricing)}
              staffId={staffId}
              name={name}
              categories={pricing}
            />
          ) : (
            <EmptyState
              message={`${name} todavía no hace ningún servicio. Márcalos en Servicios.`}
            />
          ))}
      </PendingArea>
    </div>
  );
}
