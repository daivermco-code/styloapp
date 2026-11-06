import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { BusinessCatalog } from "@/features/explore/components/business-catalog";
import { BusinessHeader } from "@/features/explore/components/business-header";
import { findService } from "@/features/explore/lib/search";
import { getBusinessPage } from "@/features/explore/services/queries";
import { VisitCounter } from "@/features/reports/components/visit-counter";
import { ClientTopBar } from "@/shared/components/top-bar";
import { todayInBogota } from "@/shared/lib/dates";

type Param = string | string[] | undefined;

interface BusinessPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    servicio?: Param;
    profesional?: Param;
    dia?: Param;
    hora?: Param;
  }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function single(value: Param): string | null {
  return typeof value === "string" ? value : null;
}

async function loadBusiness(id: string) {
  return UUID.test(id) ? getBusinessPage(id) : null;
}

export async function generateMetadata({
  params,
}: BusinessPageProps): Promise<Metadata> {
  const business = await loadBusiness((await params).id);
  return { title: business?.name ?? "Negocio" };
}

// Página del negocio (US-026) con la reserva del cliente (US-027). No pide sesión. Lo elegido
// viaja en la URL (?servicio=&profesional=&dia=&hora=) para volver de entrar con todo puesto;
// lo que no sirve se ignora: un día pasado o mal escrito queda en hoy.
export default async function BusinessPage({
  params,
  searchParams,
}: BusinessPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [business, person] = await Promise.all([
    loadBusiness(id),
    getCurrentPerson(),
  ]);
  if (!business) notFound();

  const today = todayInBogota();
  const day = single(query.dia);
  const time = single(query.hora);
  const initial = {
    service: findService(business.categories, single(query.servicio)),
    staffId: single(query.profesional),
    day: day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= today ? day : today,
    time: time && /^\d{2}:\d{2}$/.test(time) ? time : null,
  };
  const signedIn = person !== null;

  return (
    <>
      <ClientTopBar title="Negocio" />
      <VisitCounter businessId={business.id} />
      <main>
        <BusinessCatalog
          business={business}
          signedIn={signedIn}
          today={today}
          initial={initial}
          header={<BusinessHeader business={business} signedIn={signedIn} />}
        />
      </main>
    </>
  );
}
