"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const PROMPT_TITLE = "Mejora tu experiencia";

/** A dónde va Entrar: la página de entrar, que vuelve a `next` (solo rutas internas). */
export function signInHref(next: string): string {
  return `/entrar?siguiente=${encodeURIComponent(next)}`;
}

function PromptBody({ next }: { next: string }) {
  return (
    <>
      <p className="text-16 text-ink">
        Para <strong>reservar citas</strong>, <strong>seguir negocios</strong> y
        ver tus reservas, entra con tu celular. Te llega un código a la bandeja
        de la demo.
      </p>
      <Button asChild className="w-full max-w-xs">
        <Link href={signInHref(next)}>Entrar</Link>
      </Button>
    </>
  );
}

// "Mejora tu experiencia" (US-024, captura 96): lo personal sin sesión. En la página de Mis
// Reservas, Mi reputación… ocupa la pantalla; Seguir y el menú lo abren en una ventana.
export function LoginPrompt({
  next,
  className,
}: {
  next: string;
  className?: string;
}) {
  return (
    <section
      aria-labelledby="mejora-tu-experiencia"
      className={cn(
        "flex flex-col items-center gap-5 px-6 py-16 text-center",
        className,
      )}
    >
      <h2 id="mejora-tu-experiencia" className="text-25 font-bold text-primary">
        {PROMPT_TITLE}
      </h2>
      <PromptBody next={next} />
    </section>
  );
}

interface LoginPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  next: string;
}

export function LoginPromptDialog({
  open,
  onOpenChange,
  next,
}: LoginPromptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col items-center gap-5 py-10 text-center">
        <DialogTitle className="text-25 font-bold text-primary">
          {PROMPT_TITLE}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Entra con tu celular para seguir negocios y reservar.
        </DialogDescription>
        <PromptBody next={next} />
      </DialogContent>
    </Dialog>
  );
}
