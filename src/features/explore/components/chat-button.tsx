"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { formatPhone } from "@/shared/lib/phone";

// Chatear (US-026): muestra el WhatsApp del negocio, pero en la demo no se abre nada fuera del
// computador (invariante 7).
export function ChatButton({
  businessName,
  whatsapp,
}: {
  businessName: string;
  whatsapp: string;
}) {
  const hydrated = useHydrated();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={!hydrated}>
          <MessageCircle aria-hidden />
          Chatear
        </Button>
      </DialogTrigger>
      <DialogContent className="flex flex-col items-center gap-4 py-10 text-center">
        <DialogTitle className="text-20 font-bold text-primary">
          WhatsApp de {businessName}
        </DialogTitle>
        <p className="text-25 font-bold text-ink">{formatPhone(whatsapp)}</p>
        <DialogDescription className="text-16 text-slate">
          En la demo no se abre WhatsApp.
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
