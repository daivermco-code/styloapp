import { TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentPerson } from "@/features/auth/services/queries";
import {
  FollowersList,
  FollowersListSkeleton,
} from "@/features/reports/components/followers-list";
import {
  StatsCards,
  StatsCardsSkeleton,
} from "@/features/reports/components/stats-cards";
import {
  getBusinessFollowers,
  getBusinessInsights,
} from "@/features/reports/services/queries";
import { getMyStaff } from "@/features/team/services/queries";
import { TopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Estadísticas" };

async function Insights({ businessId }: { businessId: string }) {
  return <StatsCards insights={await getBusinessInsights(businessId)} />;
}

async function Followers({ businessId }: { businessId: string }) {
  return <FollowersList followers={await getBusinessFollowers(businessId)} />;
}

// Estadísticas del negocio (T-14.1.2, US-058, Pantalla 23): la ve el equipo del negocio, el dueño
// desde Marketing y ventas y los dos desde el contador de seguidores. Las funciones de la base
// tampoco le responden a nadie más (invariante 13).
export default async function StatsPage() {
  const person = await getCurrentPerson();
  if (!person) redirect("/entrar?siguiente=/pro/estadisticas");
  const staff = await getMyStaff(person.id);
  // El proxy solo deja entrar a /pro a quien tiene una fila activa en staff (invariante 1).
  if (!staff) redirect("/pro");

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <TopBar
        title="Estadísticas"
        icon={<TrendingUp strokeWidth={1.8} />}
        backHref="/pro"
      />
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 px-4 py-4 md:py-6">
        <Suspense fallback={<StatsCardsSkeleton />}>
          <Insights businessId={staff.businessId} />
        </Suspense>
        <Suspense fallback={<FollowersListSkeleton />}>
          <Followers businessId={staff.businessId} />
        </Suspense>
      </main>
    </div>
  );
}
