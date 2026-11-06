"use client";

import { ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { DemoSide } from "@/features/auth/services/queries";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import type { Inbox } from "../hooks/use-inbox";
import { InboxList } from "./inbox-list";

interface InboxSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inbox: Inbox;
  /** "Mateo Gómez · Cliente", o null sin sesión. */
  personLabel: string | null;
  side: DemoSide | null;
}

/** De quién es la bandeja, para el subtítulo (también en /bandeja). */
export function inboxOwnerLabel(
  personLabel: string | null,
  phoneLabel: string | null,
): string {
  if (personLabel) return personLabel;
  return phoneLabel
    ? `Entrando con ${phoneLabel}`
    : "Sin sesión: aquí llega el código cuando lo pidas.";
}

// Bandeja de la demo (UI pantalla 6): hoja al 85 % del alto en el celular y panel derecho de
// 400 px en computador.
export function InboxSheet({
  open,
  onOpenChange,
  inbox,
  personLabel,
  side,
}: InboxSheetProps) {
  const desktop = useMediaQuery("(min-width: 1024px)");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        className={cn(
          "flex flex-col gap-0 p-0",
          desktop ? "w-[400px] sm:max-w-[400px]" : "h-[85dvh]",
        )}
      >
        <SheetHeader className="border-b border-line px-5 pb-3 pt-5 text-left">
          <SheetTitle className="pr-8 text-18 font-bold text-secondary">
            Bandeja de la demo
          </SheetTitle>
          <SheetDescription className="text-14 text-slate">
            {inboxOwnerLabel(personLabel, inbox.phoneLabel)}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5">
          <InboxList
            inbox={inbox}
            side={side}
            onNavigate={() => onOpenChange(false)}
          />
        </div>
        <a
          href="/bandeja"
          target="_blank"
          rel="noopener"
          className="flex items-center justify-center gap-2 border-t border-line px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] text-14 font-bold text-primary hover:bg-soft"
        >
          <ExternalLink className="size-4" />
          Abrir en otra pestaña
        </a>
      </SheetContent>
    </Sheet>
  );
}
