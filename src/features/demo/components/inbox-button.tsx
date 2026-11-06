"use client";

import { Inbox as InboxIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import type { DemoSide } from "@/features/auth/services/queries";
import { cn } from "@/lib/utils";
import { useInbox } from "../hooks/use-inbox";
import { useInboxStore } from "../store/inbox-store";
import { InboxSheet } from "./inbox-sheet";

interface InboxButtonProps {
  /** Celular de la persona con sesión; null sin sesión. */
  phone: string | null;
  /** "Mateo Gómez · Cliente", o null sin sesión. */
  personLabel: string | null;
  side: DemoSide | null;
}

// Botón de la bandeja (UI pantalla 6): 44 px en petróleo profundo, abajo a la izquierda (en la app
// de clientes, encima de la barra inferior), con los no leídos en rojo. Va en todas las zonas,
// menos en /bandeja. Mientras se entra (celular y código) muestra los códigos del celular que está
// entrando, como sin sesión, aunque haya otra persona con sesión: así se cambia de persona sin
// cerrar sesión antes.
export function InboxButton(props: InboxButtonProps) {
  const pathname = usePathname();
  const signingIn = pathname === "/entrar" || pathname === "/entrar/codigo";
  const { phone, personLabel, side } = signingIn
    ? { phone: null, personLabel: null, side: null }
    : props;
  const open = useInboxStore((state) => state.open);
  const setOpen = useInboxStore((state) => state.setOpen);
  const inbox = useInbox({ phone, active: open });

  if (pathname === "/bandeja") return null;
  const aboveBottomNav = pathname === "/app" || pathname.startsWith("/app/");
  const unread = inbox.unreadCount;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          unread > 0
            ? `Bandeja de la demo, ${unread} sin leer`
            : "Bandeja de la demo"
        }
        className={cn(
          "fixed left-4 z-40 flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-card transition duration-120 ease-out hover:bg-primary-800 active:scale-[0.98]",
          aboveBottomNav
            ? "bottom-[calc(76px+env(safe-area-inset-bottom))] lg:bottom-4"
            : "bottom-4",
          // Encima del pie de totales (Facturas, Gastos, el liquidador), que mide 73 px.
          "[body:has([data-lifts-inbox])_&]:bottom-[calc(88px+env(safe-area-inset-bottom))]",
        )}
      >
        <InboxIcon className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-10 font-bold text-surface">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <InboxSheet
        open={open}
        onOpenChange={setOpen}
        inbox={inbox}
        personLabel={personLabel}
        side={side}
      />
    </>
  );
}
