import type { Metadata } from "next";
import { Suspense } from "react";
import { AgendaRealtime } from "@/features/agenda/components/agenda-realtime";
import { getCurrentPerson } from "@/features/auth/services/queries";
import {
  HomeCounters,
  HomeCountersSkeleton,
} from "@/features/home/components/home-counters";
import { HomeHeader } from "@/features/home/components/home-header";
import { ModuleGrid } from "@/features/home/components/module-grid";
import { getHomeBusiness } from "@/features/home/services/queries";
import { getMyStaff } from "@/features/team/services/queries";

export const metadata: Metadata = { title: "Inicio" };

// Inicio por rol (US-006 y US-007). En computador los módulos están en el menú lateral y el
// centro deja solo el encabezado con los contadores, que se refrescan solos con los cambios de la
// agenda (T-3.3.3).
export default async function ProHomePage() {
  const person = await getCurrentPerson();
  // El proxy solo deja llegar aquí a quien tiene una fila activa en staff (invariante 1).
  if (!person?.business) return null;
  const business = await getHomeBusiness(person.business.id);
  if (!business) return null;
  const side = person.side === "owner" ? "owner" : "staff";
  // El profesional cuenta solo sus citas: escucha su columna.
  const staff = side === "staff" ? await getMyStaff(person.id) : null;

  return (
    <main className="pb-24 md:mx-auto md:max-w-[720px] md:pt-6">
      <HomeHeader person={person} business={business} side={side}>
        <Suspense fallback={<HomeCountersSkeleton side={side} />}>
          <HomeCounters businessId={business.id} side={side} />
        </Suspense>
      </HomeHeader>
      <div className="lg:hidden">
        <ModuleGrid side={side} />
      </div>
      <AgendaRealtime
        businessId={business.id}
        staffId={staff?.id ?? null}
        phone={person.phone}
      />
    </main>
  );
}
