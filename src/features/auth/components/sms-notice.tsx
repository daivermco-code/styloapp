"use client";

import { MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { useInboxStore } from "@/features/demo/store/inbox-store";
import type { CodeNotice } from "../types/code-notice";

const NOTICE_DURATION_MS = 6000;

// Aviso del código (UI pantalla 1): baja desde arriba como un SMS, se queda 6 s y al tocarlo
// abre la bandeja de la demo.
function SmsNoticeCard({
  notice,
  onOpen,
}: {
  notice: CodeNotice;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 text-left"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary">
        <MessageSquareText className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-12 text-slate">SMS · ahora</span>
        <span className="font-bold">{notice.title}</span>
        <span>{notice.body}</span>
      </span>
    </button>
  );
}

export function showCodeNotice(notice: CodeNotice): void {
  useInboxStore.getState().codeSent();
  toast.custom(
    (id) => (
      <SmsNoticeCard
        notice={notice}
        onOpen={() => {
          toast.dismiss(id);
          useInboxStore.getState().setOpen(true);
        }}
      />
    ),
    { id: notice.id, duration: NOTICE_DURATION_MS },
  );
}
