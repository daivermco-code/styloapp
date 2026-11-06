"use client";

import { Info, Search } from "lucide-react";
import { type ReactNode, useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BookingServiceOption } from "@/features/agenda/types/agenda";
import { ClientBooking } from "@/features/booking/components/client-booking";
import { ONLINE_BOOKING_OFF } from "@/features/business/lib/functions";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { workSamples } from "../lib/samples";
import { filterServices } from "../lib/search";
import type { BusinessPage } from "../types/explore";
import { SampleGrid, StaffList } from "./business-tabs";
import { ChatButton } from "./chat-button";
import { PromotionList, ServiceList } from "./service-list";

const NO_SERVICES = "No encontramos servicios con esa búsqueda.";

const TAB_CLASS =
  "min-h-11 flex-1 rounded-full px-2 text-16 font-bold text-slate transition-colors duration-120 hover:bg-primary-50 data-[state=active]:bg-primary data-[state=active]:text-surface data-[state=active]:shadow-none";

interface BusinessCatalogProps {
  business: BusinessPage;
  signedIn: boolean;
  today: string;
  /** Lo elegido que trae la URL: abre la hoja con eso puesto. */
  initial: {
    service: BookingServiceOption | null;
    staffId: string | null;
    day: string;
    time: string | null;
  };
  /** El encabezado del negocio, que se pinta en el servidor. */
  header: ReactNode;
}

function CatalogTabs({
  business,
  query,
  onBook,
}: {
  business: BusinessPage;
  query: string;
  onBook: (serviceId: string) => void;
}) {
  const categories = filterServices(business.categories, query);
  return (
    <Tabs defaultValue="servicios" className="flex flex-col gap-4">
      <TabsList className="mx-4 flex h-auto gap-1 rounded-full bg-soft p-1 md:mx-6">
        <TabsTrigger value="servicios" className={TAB_CLASS}>
          Servicios
        </TabsTrigger>
        <TabsTrigger value="muestras" className={TAB_CLASS}>
          Muestras
        </TabsTrigger>
        <TabsTrigger value="profesionales" className={TAB_CLASS}>
          Profesionales
        </TabsTrigger>
      </TabsList>
      <TabsContent value="servicios" className="mt-0">
        {categories.length === 0 ? (
          <p className="px-4 py-10 text-center text-14 text-slate">
            {query.trim()
              ? NO_SERVICES
              : "Este negocio no tiene servicios para reservar."}
          </p>
        ) : (
          <ServiceList
            categories={categories}
            searching={query.trim().length > 0}
            onBook={onBook}
          />
        )}
      </TabsContent>
      <TabsContent value="muestras" className="mt-0">
        <SampleGrid samples={workSamples(business.kind)} />
      </TabsContent>
      <TabsContent value="profesionales" className="mt-0">
        <StaffList staff={business.staff} />
      </TabsContent>
    </Tabs>
  );
}

interface CatalogToolbarProps {
  business: BusinessPage;
  query: string;
  onQuery: (query: string) => void;
  onlyPromos: boolean;
  onOnlyPromos: (on: boolean) => void;
}

// Buscador de servicios, "Solo promociones" y Chatear.
function CatalogToolbar({
  business,
  query,
  onQuery,
  onlyPromos,
  onOnlyPromos,
}: CatalogToolbarProps) {
  const hydrated = useHydrated();
  return (
    <div className="flex flex-col gap-3 px-4 md:px-6">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate"
        />
        <Input
          type="search"
          aria-label="Busca un servicio"
          placeholder="Busca un servicio"
          value={query}
          disabled={!hydrated || onlyPromos}
          onChange={(event) => onQuery(event.target.value)}
          className="pl-12"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-14 text-ink">
          <Switch
            checked={onlyPromos}
            disabled={!hydrated}
            onCheckedChange={onOnlyPromos}
          />
          Solo promociones
        </label>
        {business.whatsapp && (
          <ChatButton
            businessName={business.name}
            whatsapp={business.whatsapp}
          />
        )}
      </div>
    </div>
  );
}

// Página del negocio (US-026, capturas 98, 99 y 192): buscador de servicios, Chatear, el
// interruptor de solo promociones y las pestañas. Agendar sube la hoja de reservar (US-027): en
// el celular, abajo; desde 1024 px, en una columna a la derecha.
export function BusinessCatalog({
  business,
  signedIn,
  today,
  initial,
  header,
}: BusinessCatalogProps) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [onlyPromos, setOnlyPromos] = useState(false);
  const [service, setService] = useState(
    business.onlineBooking ? initial.service : null,
  );
  const [fromUrl, setFromUrl] = useState(initial.service !== null);

  const book = (serviceId: string) => {
    if (!business.onlineBooking) {
      toast.error(ONLINE_BOOKING_OFF);
      return;
    }
    const found = business.categories
      .flatMap((category) => category.services)
      .find((option) => option.id === serviceId);
    setFromUrl(false);
    setService(found ?? null);
  };

  return (
    <div
      className={cn(
        service && "lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start",
      )}
    >
      <div className="flex min-w-0 flex-col gap-5 pb-8">
        {header}
        {!business.onlineBooking && (
          <p
            role="note"
            className="mx-4 flex items-start gap-2 rounded-card bg-tertiary p-3 text-14 text-secondary md:mx-6"
          >
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {ONLINE_BOOKING_OFF}
          </p>
        )}
        <CatalogToolbar
          business={business}
          query={query}
          onQuery={setQuery}
          onlyPromos={onlyPromos}
          onOnlyPromos={setOnlyPromos}
        />
        {onlyPromos ? (
          <PromotionList promotions={business.promotions} />
        ) : (
          <CatalogTabs business={business} query={deferred} onBook={book} />
        )}
        {/* Deja ver el final de la lista por encima de la hoja. */}
        {service && <div aria-hidden className="h-[60dvh] lg:hidden" />}
      </div>

      {/* En celular la hoja deja abajo el espacio del botón de la bandeja (76 + 44 px y 16 de aire). */}
      {service && (
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
          className="fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] overflow-y-auto rounded-t-sheet pb-[calc(136px+env(safe-area-inset-bottom))] shadow-sheet lg:sticky lg:inset-auto lg:top-0 lg:max-h-dvh lg:rounded-none lg:border-l lg:border-line lg:pb-6 lg:shadow-none"
        />
      )}
    </div>
  );
}
