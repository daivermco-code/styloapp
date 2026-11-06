"use client";

import { ChevronRight, HandCoins } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PaymentMethod } from "@/features/business/types/payment";
import { invoiceTitle } from "@/features/invoices/lib/totals";
import { PunctualityPicker } from "@/features/reviews/components/punctuality-picker";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import {
  formatDayOfMonth,
  formatShortDate,
  formatTime,
} from "@/shared/lib/dates";
import { formatCOP } from "@/shared/lib/money";
import type {
  PayrollDetail as Detail,
  PendingItem,
  UnmarkedBooking,
} from "../types/payroll";
import { PayDialog } from "./pay-dialog";
import { Skeleton } from "@/components/ui/skeleton";

function UnmarkedList({
  name,
  bookings,
}: {
  name: string;
  bookings: UnmarkedBooking[];
}) {
  return (
    <section aria-labelledby="unmarked-title" className="flex flex-col gap-3">
      <h3
        id="unmarked-title"
        className="rounded-card bg-warning/10 px-4 py-3 text-16 font-bold text-ink"
      >
        Marca estas citas antes de pagarle a {name}.
      </h3>
      <ul className="flex flex-col divide-y divide-line">
        {bookings.map((booking) => (
          <li key={booking.id} className="flex flex-col gap-3 py-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-16 font-bold text-ink first-letter:uppercase">
                {formatShortDate(booking.startsAt)} ·{" "}
                {formatTime(booking.startsAt)}
              </p>
              <p className="text-14 text-slate">
                {booking.clientName} · {booking.serviceName}
              </p>
            </div>
            <PunctualityPicker
              bookingId={booking.id}
              value={null}
              showQuestion={false}
              groupLabel={`Llegada de ${booking.clientName}, ${formatShortDate(booking.startsAt)} · ${formatTime(booking.startsAt)}`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ItemRow({ item }: { item: PendingItem }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={`/pro/facturas/${item.invoiceId}`}
          className="-my-2 inline-flex min-h-11 items-center gap-1 self-start rounded-card text-16 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {invoiceTitle(item.invoiceNumber)} · {formatDayOfMonth(item.issuedOn)}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
        <span className="text-12 text-slate">
          {item.serviceName} · {formatCOP(item.price)}
        </span>
      </span>
      <span className="shrink-0 text-16 font-bold text-ink">
        <span className="sr-only">Comisión: </span>
        {formatCOP(item.commission)}
      </span>
    </li>
  );
}

const BLOCKED_REASON = "pay-blocked-reason";

/** Por qué "Pagar" está apagado, o null si se puede pagar. */
function blockedReason(blocked: boolean, methods: number): string | null {
  if (blocked) return "Marca las citas de arriba para poder pagar.";
  if (methods === 0)
    return "Activa un método de pago en Configurar para poder pagar.";
  return null;
}

/** El pie fijo: el total, "Pagar" (con su razón si está apagado) y la ventana del pago. */
function PayFooter({
  detail,
  methods,
  today,
}: {
  detail: Detail;
  methods: PaymentMethod[];
  today: string;
}) {
  const hydrated = useHydrated();
  const [paying, setPaying] = useState(false);
  // Cada vez que se abre, la ventana empieza de cero (sin errores ni lo de la vez anterior).
  const [opened, setOpened] = useState(0);
  const reason = blockedReason(detail.unmarked.length > 0, methods.length);

  return (
    <div className="sticky bottom-0 -mx-5 flex flex-col gap-3 border-t border-line bg-surface px-5 pb-6 pt-4">
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-16 text-ink">Total a pagar</span>
        <span className="text-22 font-bold text-primary">
          {formatCOP(detail.total)}
        </span>
      </p>
      {reason && (
        <p id={BLOCKED_REASON} className="text-center text-12 text-danger">
          {reason}
        </p>
      )}
      <Button
        type="button"
        onClick={() => {
          setOpened((count) => count + 1);
          setPaying(true);
        }}
        disabled={!hydrated || reason !== null}
        aria-describedby={reason ? BLOCKED_REASON : undefined}
      >
        <HandCoins />
        Pagar
      </Button>
      <PayDialog
        key={opened}
        open={paying}
        onOpenChange={setPaying}
        staffId={detail.staffId}
        staffName={detail.name}
        total={detail.total}
        methods={methods}
        today={today}
      />
    </div>
  );
}

function DetailBody({
  detail,
  methods,
  today,
}: {
  detail: Detail;
  methods: PaymentMethod[];
  today: string;
}) {
  // El mismo criterio de la tarjeta y de pay_staff: sin comisión que pagar, no hay "Pagar".
  const nothing = detail.total === 0;
  return (
    <div className="flex flex-col gap-6">
      {detail.unmarked.length > 0 && (
        <UnmarkedList name={detail.name} bookings={detail.unmarked} />
      )}
      {nothing ? (
        <p className="pb-6 pt-4 text-center text-14 text-slate">
          {detail.name} no tiene comisiones pendientes.
        </p>
      ) : (
        <>
          <section
            aria-labelledby="items-title"
            className="flex flex-col gap-1"
          >
            <h3 id="items-title" className="text-16 font-bold text-ink">
              Servicios pendientes
            </h3>
            <ul className="flex flex-col divide-y divide-line">
              {detail.items.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </ul>
          </section>
          <PayFooter detail={detail} methods={methods} today={today} />
        </>
      )}
    </div>
  );
}

/**
 * La hoja del profesional mientras llega su detalle (Fase 17): se abre de una al tocar la tarjeta,
 * con el mismo lado y tamaño, y el contenido en esqueleto.
 */
export function PayrollDetailSkeleton() {
  const desktop = useMediaQuery("(min-width: 1024px)");
  return (
    <Sheet open>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        className={cn(
          "flex flex-col gap-5 px-5 pt-10",
          desktop ? "w-[440px] sm:max-w-[440px]" : "max-h-[90dvh]",
        )}
      >
        <SheetTitle className="sr-only">Cargando</SheetTitle>
        <SheetDescription className="sr-only">
          Llegan las comisiones del profesional.
        </SheetDescription>
        <div
          role="status"
          aria-label="Cargando"
          className="flex flex-col gap-3 pb-8"
        >
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-14 rounded-card" />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface PayrollDetailProps {
  detail: Detail;
  methods: PaymentMethod[];
  today: string;
}

// Detalle de un profesional en el liquidador (T-9.2.2, US-045, pantalla 12): hoja desde abajo en
// el celular y panel a la derecha en computador. Arriba, las citas sin marcar con sus caritas (la
// misma acción de la agenda); debajo, los servicios pendientes, el total y "Pagar", apagado
// mientras falten citas por marcar. Al cerrarla se va en el acto, con su animación, aunque la lista
// tarde en volver a calcularse.
export function PayrollDetail({ detail, methods, today }: PayrollDetailProps) {
  const router = useRouter();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [open, setOpen] = useState(true);
  const close = () => {
    setOpen(false);
    router.replace("/pro/liquidador", { scroll: false });
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        className={cn(
          "flex flex-col gap-5 overflow-y-auto px-5 pb-0 pt-10",
          desktop ? "w-[440px] sm:max-w-[440px]" : "max-h-[90dvh]",
        )}
      >
        <div className="flex flex-col gap-1">
          <SheetTitle className="text-18 font-bold text-ink">
            {detail.name}
          </SheetTitle>
          <SheetDescription className="text-14 text-slate">
            Sus comisiones de facturas pagadas que aún no le has pagado.
          </SheetDescription>
        </div>
        <DetailBody detail={detail} methods={methods} today={today} />
      </SheetContent>
    </Sheet>
  );
}
