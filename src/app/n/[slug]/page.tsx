import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentPerson } from "@/features/auth/services/queries";
import { LinkBooking } from "@/features/booking/components/link-booking";
import { findService } from "@/features/explore/lib/search";
import {
  getBusinessIdBySlug,
  getBusinessPage,
} from "@/features/explore/services/queries";
import { VisitCounter } from "@/features/reports/components/visit-counter";
import { BrandLogo } from "@/shared/components/brand-logo";
import { todayInBogota } from "@/shared/lib/dates";

type Param = string | string[] | undefined;

interface LinkPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    servicio?: Param;
    profesional?: Param;
    dia?: Param;
    hora?: Param;
  }>;
}

const LINK_NOT_FOUND = "Este enlace no es de ningún negocio de la demo.";

function single(value: Param): string | null {
  return typeof value === "string" ? value : null;
}

async function loadBusiness(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const id = await getBusinessIdBySlug(slug);
  return id ? getBusinessPage(id) : null;
}

export async function generateMetadata({
  params,
}: LinkPageProps): Promise<Metadata> {
  const business = await loadBusiness((await params).slug);
  return { title: business ? `Reserva en ${business.name}` : "Enlace" };
}

// Página por enlace del negocio (US-033), la que el negocio comparte. No pide sesión. Lo elegido
// viaja en la URL (?servicio=&profesional=&dia=&hora=) para volver de entrar con todo puesto.
export default async function LinkPage({
  params,
  searchParams,
}: LinkPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [business, person] = await Promise.all([
    loadBusiness(slug),
    getCurrentPerson(),
  ]);

  if (!business) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-6 px-4 text-center">
        <BrandLogo size={48} />
        <p role="status" className="text-18 text-ink">
          {LINK_NOT_FOUND}
        </p>
        <Button asChild>
          <Link href="/">Ir al inicio</Link>
        </Button>
      </main>
    );
  }

  const today = todayInBogota();
  const day = single(query.dia);
  const time = single(query.hora);
  return (
    <main className="min-h-dvh">
      <VisitCounter businessId={business.id} />
      <LinkBooking
        business={business}
        signedIn={person !== null}
        today={today}
        initial={{
          service: findService(business.categories, single(query.servicio)),
          staffId: single(query.profesional),
          day:
            day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= today
              ? day
              : today,
          time: time && /^\d{2}:\d{2}$/.test(time) ? time : null,
        }}
      />
    </main>
  );
}
