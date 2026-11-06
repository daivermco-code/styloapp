"use client";

import type { DemoSide } from "@/features/auth/services/queries";
import { useInbox } from "../hooks/use-inbox";
import { InboxList } from "./inbox-list";
import { inboxOwnerLabel } from "./inbox-sheet";

interface StandaloneInboxProps {
  phone: string | null;
  personLabel: string | null;
  side: DemoSide | null;
}

// La bandeja a pantalla completa (/bandeja), para tenerla abierta en otra pestaña: siempre a la
// vista, así que lo que llega queda leído.
export function StandaloneInbox({
  phone,
  personLabel,
  side,
}: StandaloneInboxProps) {
  const inbox = useInbox({ phone, active: true });

  return (
    <>
      <p className="px-4 pt-3 text-14 text-slate">
        {inboxOwnerLabel(personLabel, inbox.phoneLabel)}
      </p>
      <div className="px-4 pb-6">
        <InboxList inbox={inbox} side={side} />
      </div>
    </>
  );
}
