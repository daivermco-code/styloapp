import { ChevronRight, Frown, type LucideIcon, Meh, Smile } from "lucide-react";
import Link from "next/link";
import { BlockClientButton } from "@/features/agenda/components/block-client-button";
import {
  type ReputationLevel,
  reputationLevel,
} from "@/features/agenda/lib/rules";
import { invoiceTitle } from "@/features/invoices/lib/totals";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/components/empty-state";
import { MoneyRow } from "@/shared/components/money-row";
import { PillTabs } from "@/shared/components/pill-tabs";
import {
  formatDayMonth,
  formatDayOfMonth,
  formatTime,
} from "@/shared/lib/dates";
import { formatCOP } from "@/shared/lib/money";
import {
  type BookingStatus,
  type ClientNumbers,
  contactLine,
  lastVisitText,
} from "../lib/profile";
import type {
  ClientBooking,
  ClientInvoice,
  ClientProfile as Profile,
} from "../types/client";
import { BlockedMark, ClientInitial } from "./client-list";
import { PendingArea } from "@/shared/components/instant-nav";
import { RowsSkeleton } from "@/shared/components/page-skeleton";
import { NAV_GROUP } from "@/shared/lib/instant-nav";

export type ProfileTab = "citas" | "facturas";

export const NO_BOOKINGS = "Todavía no tiene citas.";
export const NO_INVOICES = "Todavía no tiene facturas.";

// El estado como lo dice el diseño: sin calificar hasta que el profesional marca la llegada.
const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Sin calificar",
  successful: "Efectiva",
  unsuccessful: "Abandonada",
  cancelled: "Cancelada",
};

const STATUS_CLASS: Record<BookingStatus, string> = {
  pending: "bg-soft text-slate",
  successful: "bg-success/10 text-success",
  unsuccessful: "bg-warning/15 text-ink",
  cancelled: "bg-danger/10 text-danger",
};

// La reputación como en la pantalla 15: la carita y el color salen del nivel, como en Mi reputación.
const REPUTATION: Record<
  Exclude<ReputationLevel, "unknown">,
  { label: string; icon: LucideIcon; className: string }
> = {
  excellent: {
    label: "Excelente reputación",
    icon: Smile,
    className: "text-success",
  },
  regular: {
    label: "Reputación regular",
    icon: Meh,
    className: "text-warning",
  },
  bad: { label: "Mala reputación", icon: Frown, className: "text-danger" },
};

function Reputation({ reputation }: { reputation: Profile["reputation"] }) {
  const level = reputationLevel(reputation?.score ?? null);
  if (!reputation || level === "unknown")
    return <p className="text-14 text-slate">Sin calificaciones todavía</p>;
  const { label, icon: Icon, className } = REPUTATION[level];
  const score = reputation.score.toLocaleString("es-CO", {
    maximumFractionDigits: 1,
  });
  return (
    <p className="flex items-center gap-1.5 text-14 font-bold text-ink">
      {label}
      <Icon aria-hidden className={cn("size-5", className)} />
      <span className="font-medium text-slate">({score} de 5)</span>
    </p>
  );
}

/** La pestaña de `?pestana=`; lo que no se conoce es Citas. */
export function toProfileTab(value: unknown): ProfileTab {
  return value === "facturas" ? "facturas" : "citas";
}

function Numbers({ numbers }: { numbers: ClientNumbers }) {
  const items = [
    { label: "visitas", value: String(numbers.visits) },
    { label: "última", value: lastVisitText(numbers.daysAway) },
    { label: "facturado", value: formatCOP(numbers.invoiced) },
  ];
  return (
    <dl className="grid grid-cols-3 divide-x divide-line rounded-card border border-line">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-w-0 flex-col-reverse items-center gap-0.5 px-1 py-3 text-center"
        >
          <dt className="text-12 text-slate">{item.label}</dt>
          {/* En el celular va en 16 para que "$ 12.500.000" quepa en su casilla sin partirse. */}
          <dd className="whitespace-nowrap text-16 font-bold text-primary sm:text-18">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function BookingRow({ booking }: { booking: ClientBooking }) {
  const when = `${formatDayMonth(booking.startsAt)} · ${formatTime(booking.startsAt)}`;
  const what = [booking.serviceName, booking.staffName]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      href={`/pro/agenda?cita=${booking.id}`}
      className="flex min-h-14 items-center gap-3 px-5 py-3 transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-6"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-16 text-ink">{when}</span>
        {what && <span className="text-12 text-slate">{what}</span>}
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-12 font-bold",
          STATUS_CLASS[booking.status],
        )}
      >
        {STATUS_LABEL[booking.status]}
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-slate" />
    </Link>
  );
}

function BookingList({ bookings }: { bookings: ClientBooking[] }) {
  if (bookings.length === 0) return <EmptyState message={NO_BOOKINGS} />;
  return (
    <ul
      aria-label="Citas"
      className="divide-y divide-line border-y border-line"
    >
      {bookings.map((booking) => (
        <li key={booking.id}>
          <BookingRow booking={booking} />
        </li>
      ))}
    </ul>
  );
}

function InvoiceList({ invoices }: { invoices: ClientInvoice[] }) {
  if (invoices.length === 0) return <EmptyState message={NO_INVOICES} />;
  return (
    <ul
      aria-label="Facturas"
      className="divide-y divide-line border-y border-line"
    >
      {invoices.map((invoice) => (
        <li key={invoice.id}>
          <MoneyRow
            title={invoiceTitle(invoice.number)}
            detail={[
              formatDayOfMonth(invoice.issuedOn),
              ...invoice.services,
            ].join(" · ")}
            value={invoice.total}
            voided={invoice.status === "void"}
            href={`/pro/facturas/${invoice.id}`}
          />
        </li>
      ))}
    </ul>
  );
}

// Ficha del cliente (T-10.1.3, US-048, pantalla 15, diseño propio): la inicial de 64 px, su celular y
// su cumpleaños, la reputación si tiene cuenta, los 3 números, las notas, sus citas o sus
// facturas (pestañas pastilla) y, al final, bloquear o desbloquear.
export function ClientProfile({
  profile,
  numbers,
  bookings,
  invoices,
  tab,
}: {
  profile: Profile;
  numbers: ClientNumbers;
  bookings: ClientBooking[];
  invoices: ClientInvoice[];
  tab: ProfileTab;
}) {
  const contact = contactLine(profile.phone, profile.birthDate);
  const path = `/pro/clientes/${profile.id}`;
  return (
    <>
      <section
        aria-label="Datos del cliente"
        className="flex flex-col items-center gap-1 px-5 text-center md:px-6"
      >
        <ClientInitial
          name={profile.fullName}
          className="size-16 bg-primary text-25 text-primary-foreground"
        />
        <p className="mt-1 flex items-center gap-1.5 text-14 text-slate">
          {contact ?? "Sin celular"}
          {profile.isBlocked && <BlockedMark />}
        </p>
        {profile.hasAccount && <Reputation reputation={profile.reputation} />}
      </section>
      <div className="flex flex-col gap-3 px-5 md:px-6">
        <Numbers numbers={numbers} />
        {profile.notes && (
          <p className="whitespace-pre-line break-words text-14 text-ink">
            <span className="font-bold">Notas:</span> {profile.notes}
          </p>
        )}
        <PillTabs
          label="Historial del cliente"
          tabs={[
            { label: "Citas", href: path, selected: tab === "citas" },
            {
              label: "Facturas",
              href: `${path}?pestana=facturas`,
              selected: tab === "facturas",
            },
          ]}
        />
      </div>
      <PendingArea
        groups={[NAV_GROUP.tabs]}
        fallback={
          <div className="px-5 md:px-6">
            <RowsSkeleton />
          </div>
        }
      >
        {tab === "citas" ? (
          <BookingList bookings={bookings} />
        ) : (
          <InvoiceList invoices={invoices} />
        )}
      </PendingArea>
      <div className="flex justify-center px-5 pb-24 pt-2">
        <BlockClientButton
          clientId={profile.id}
          name={profile.fullName}
          blocked={profile.isBlocked}
          look="outline"
        />
      </div>
    </>
  );
}
