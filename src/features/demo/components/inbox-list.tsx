"use client";

import {
  Bell,
  MessageCircle,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { DemoSide } from "@/features/auth/services/queries";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/components/empty-state";
import { formatShortDate, formatTime, todayInBogota } from "@/shared/lib/dates";
import type { Inbox } from "../hooks/use-inbox";
import type { InboxChannel, InboxMessage } from "../types/inbox";

const CHANNELS: Record<
  InboxChannel,
  { label: string; icon: LucideIcon; className: string }
> = {
  sms: {
    label: "SMS",
    icon: MessageSquareText,
    className: "bg-soft text-slate",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    className: "bg-success/10 text-success",
  },
  push: {
    label: "Notificación",
    icon: Bell,
    className: "bg-primary-50 text-primary",
  },
};

function when(deliverAt: string): string {
  const time = formatTime(deliverAt);
  return todayInBogota(deliverAt) === todayInBogota()
    ? time
    : `${formatShortDate(deliverAt)} · ${time}`;
}

/**
 * La cita del mensaje, en el lado de quien lo recibió: el negocio y el equipo la abren en la agenda
 * (US-023); el cliente, en Mis Reservas (T-5.4.1), y la invitación a calificar ("¿Cómo te fue?"),
 * en la página de calificar.
 */
function bookingHref(
  message: InboxMessage,
  side: DemoSide | null,
): string | null {
  if (!message.bookingId || !side) return null;
  if (side !== "client") return `/pro/agenda?cita=${message.bookingId}`;
  if (message.kind === "booking_successful") {
    return `/app/calificar/${message.bookingId}`;
  }
  return `/app/reservas?cita=${message.bookingId}`;
}

function MessageItem({
  message,
  fresh,
  animate,
  href,
  onNavigate,
}: {
  message: InboxMessage;
  fresh: boolean;
  animate: boolean;
  href: string | null;
  onNavigate?: () => void;
}) {
  const channel = CHANNELS[message.channel];
  const Icon = channel.icon;
  const content = (
    <>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          channel.className,
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-start gap-2">
          <span className="flex-1 text-14 font-bold text-ink">
            {message.title}
          </span>
          {fresh && (
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
              <span className="sr-only">Nuevo</span>
            </span>
          )}
        </span>
        <span className="text-14 text-ink">{message.body}</span>
        <span className="text-12 text-slate">
          {channel.label} · {when(message.deliverAt)}
        </span>
      </span>
    </>
  );
  return (
    <li
      className={cn(
        animate &&
          "duration-220 ease-out-quart animate-in fade-in slide-in-from-top-2",
      )}
    >
      {href ? (
        <Link
          href={href}
          onClick={onNavigate}
          className="flex gap-3 py-3 hover:bg-soft"
        >
          {content}
        </Link>
      ) : (
        <div className="flex gap-3 py-3">{content}</div>
      )}
    </li>
  );
}

// Lista de la bandeja (UI pantalla 6), en la hoja y en /bandeja.
export function InboxList({
  inbox,
  side,
  onNavigate,
}: {
  inbox: Inbox;
  side: DemoSide | null;
  /** Al abrir la cita de un aviso: la hoja se cierra para dejar ver la agenda. */
  onNavigate?: () => void;
}) {
  // Los que ya estaban al cargar no se animan; los que llegan después entran deslizándose.
  const [initialIds, setInitialIds] = useState<ReadonlySet<string> | null>(
    () =>
      inbox.loaded
        ? new Set(inbox.messages.map((message) => message.id))
        : null,
  );
  if (initialIds === null && inbox.loaded) {
    setInitialIds(new Set(inbox.messages.map((message) => message.id)));
  }

  if (!inbox.loaded) {
    if (inbox.failed) {
      return (
        <EmptyState message="No hay conexión con la demo. Revisa que la base esté prendida." />
      );
    }
    return (
      <div className="flex flex-col gap-3 py-3" aria-busy="true">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (inbox.messages.length === 0) {
    return <EmptyState message="Todavía no te ha llegado nada." />;
  }
  return (
    <ul className="divide-y divide-line">
      {inbox.messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          fresh={inbox.freshIds.has(message.id)}
          animate={initialIds !== null && !initialIds.has(message.id)}
          href={bookingHref(message, side)}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
}
