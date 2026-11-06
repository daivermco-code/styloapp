"use client";

import { Check, Info, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BookingServiceOption } from "@/features/agenda/types/agenda";
import { ONLINE_BOOKING_OFF } from "@/features/business/lib/functions";
import { BusinessLogo } from "@/features/explore/components/business-logo";
import { FollowButton } from "@/features/explore/components/follow-button";
import { signInHref } from "@/features/explore/components/login-prompt";
import type { BusinessPage } from "@/features/explore/types/explore";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/shared/components/brand-logo";
import { RatingSummary } from "@/shared/components/stars";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { formatMinutes } from "@/shared/lib/duration";
import type { SheetChoice } from "./booking-sheet";
import { ClientBooking } from "./client-booking";

export const PICK_A_TIME = "Elige una hora para agendar.";

const TAB_CLASS =
  "min-h-11 shrink-0 rounded-full px-4 text-16 font-bold text-slate transition-colors duration-120 hover:bg-primary-50 data-[state=active]:bg-primary data-[state=active]:text-surface data-[state=active]:shadow-none";

/** La página por enlace con todo lo elegido, para volver después de entrar. */
function linkPath(slug: string, serviceId: string, choice?: SheetChoice) {
  const params = new URLSearchParams({ servicio: serviceId });
  if (choice) {
    params.set("profesional", choice.staffId);
    params.set("dia", choice.day);
    params.set("hora", choice.time);
  }
  return `/n/${slug}?${params.toString()}`;
}

function BusinessCard({
  business,
  signedIn,
}: {
  business: BusinessPage;
  signedIn: boolean;
}) {
  return (
    <section
      aria-label="El negocio"
      className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card"
    >
      <div className="flex items-center gap-3">
        <BusinessLogo
          name={business.name}
          logoUrl={business.logoUrl}
          size={64}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="text-22 font-bold leading-tight text-primary">
            {business.name}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 text-14 text-slate">
            <RatingSummary score={business.score} reviews={business.reviews} />
            <span>
              · {business.bookings.toLocaleString("es-CO")} agendamientos
            </span>
          </p>
          <p className="flex items-start gap-1 text-14 text-slate">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            {[business.address, business.neighborhood]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <FollowButton
        businessId={business.id}
        following={business.following}
        followers={business.followers}
        signedIn={signedIn}
        next={`/n/${business.slug}`}
        className="self-start"
      />
    </section>
  );
}

interface ServicePickerProps {
  business: BusinessPage;
  chosenId: string | null;
  onChoose: (service: BookingServiceOption) => void;
}

// Servicios por categoría en pestañas, con duración y precio; se elige uno tocándolo.
function ServicePicker({ business, chosenId, onChoose }: ServicePickerProps) {
  const hydrated = useHydrated();
  const first = business.categories[0];
  if (!first) {
    return (
      <p className="py-10 text-center text-14 text-slate">
        Este negocio no tiene servicios para reservar.
      </p>
    );
  }
  return (
    <Tabs defaultValue={first.id} className="flex flex-col gap-3">
      <TabsList className="flex h-auto justify-start gap-1 overflow-x-auto rounded-full bg-soft p-1 [scrollbar-width:none]">
        {business.categories.map((category) => (
          <TabsTrigger
            key={category.id}
            value={category.id}
            className={TAB_CLASS}
          >
            {category.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {business.categories.map((category) => (
        <TabsContent key={category.id} value={category.id} className="mt-0">
          <ul aria-label={`Servicios de ${category.name}`}>
            {category.services.map((service) => {
              const chosen = service.id === chosenId;
              return (
                <li key={service.id} className="border-b border-line">
                  <button
                    type="button"
                    aria-pressed={chosen}
                    disabled={!hydrated || !business.onlineBooking}
                    onClick={() => onChoose(service)}
                    className="flex min-h-14 w-full items-center gap-3 px-1 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-16 text-ink">{service.name}</span>
                      <span className="text-14 text-slate">
                        {formatMinutes(service.durationMinutes)}
                      </span>
                    </span>
                    <span className="text-16 font-bold text-ink">
                      {service.priceLabel}
                    </span>
                    {business.onlineBooking && (
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                          chosen
                            ? "border-primary bg-primary text-surface"
                            : "border-stroke",
                        )}
                      >
                        {chosen && <Check className="size-4" strokeWidth={3} />}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </TabsContent>
      ))}
    </Tabs>
  );
}

interface LinkBookingProps {
  business: BusinessPage;
  signedIn: boolean;
  today: string;
  /** Lo elegido que trae la URL (vuelve de entrar con todo puesto). */
  initial: {
    service: BookingServiceOption | null;
    staffId: string | null;
    day: string;
    time: string | null;
  };
}

// Página por enlace del negocio (US-033): una página web suelta, sin la barra de la app de
// clientes. Bienvenida con Entrar, la tarjeta del negocio, los servicios por categoría y, al
// elegir uno, el resumen con "Cambiar", el profesional, la fecha y las horas; "Agendar cita"
// sigue el camino de la Fase 5 (entrar, revisar y éxito).
export function LinkBooking({
  business,
  signedIn,
  today,
  initial,
}: LinkBookingProps) {
  const [service, setService] = useState(
    business.onlineBooking ? initial.service : null,
  );
  const [fromUrl, setFromUrl] = useState(initial.service !== null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Al elegir un servicio, la hoja se trae a la vista (queda debajo de la lista).
  useEffect(() => {
    if (service && !fromUrl) {
      sheetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [service, fromUrl]);

  const choose = (option: BookingServiceOption) => {
    setFromUrl(false);
    setService(option);
  };
  const here = service
    ? linkPath(business.slug, service.id)
    : `/n/${business.slug}`;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-4 pb-32 pt-3 md:px-6">
      <header className="flex items-center justify-between gap-3">
        <BrandLogo size={34} />
        {signedIn ? (
          <Button asChild variant="ghost">
            <Link href="/app/reservas">Mis citas</Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href={signInHref(here)}>Entrar</Link>
          </Button>
        )}
      </header>

      <p className="text-18 text-ink">Bienvenido, reserva en</p>
      <BusinessCard business={business} signedIn={signedIn} />

      {!business.onlineBooking && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-card bg-tertiary p-3 text-14 text-secondary"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {ONLINE_BOOKING_OFF}
        </p>
      )}

      <ServicePicker
        business={business}
        chosenId={service?.id ?? null}
        onChoose={choose}
      />

      {service && (
        <div ref={sheetRef} className="scroll-mt-4">
          <ClientBooking
            key={service.id}
            place={business}
            service={service}
            today={today}
            initial={
              fromUrl
                ? {
                    staffId: initial.staffId,
                    day: initial.day,
                    time: initial.time,
                  }
                : { staffId: null, day: today, time: null }
            }
            signedIn={signedIn}
            onClose={() => setService(null)}
            returnPath={(choice) => linkPath(business.slug, service.id, choice)}
            submitLabel="Agendar cita"
            closeText="Cambiar"
            missingMessage={PICK_A_TIME}
            className="rounded-card shadow-card"
          />
        </div>
      )}
    </div>
  );
}
