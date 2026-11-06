"use client";

import { Share2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useBusinessLink, useShareLink } from "../hooks/use-business-link";
import { QrImage } from "./qr-image";

interface BusinessQrDialogProps {
  slug: string;
  /** El botón que la abre (el ícono del inicio o "Código QR" del perfil del negocio). */
  trigger: ReactNode;
}

// Ventana del QR (US-008, captura 45-qr): el texto, el QR de la página de reservas y "Compartir".
export function BusinessQrDialog({ slug, trigger }: BusinessQrDialogProps) {
  const link = useBusinessLink(slug);
  const share = useShareLink(slug);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="justify-items-center gap-6 px-6 py-16 text-center">
        <DialogTitle className="sr-only">Código QR del negocio</DialogTitle>
        <DialogDescription className="text-16 text-ink">
          Muestra este código a tus clientes para que reserven contigo desde su
          celular.
        </DialogDescription>
        <QrImage
          value={link}
          size={144}
          label="Código QR de la página de reservas"
        />
        <button
          type="button"
          onClick={() => void share()}
          className="flex min-h-11 flex-col items-center gap-1 rounded-card px-4 py-1 text-16 text-primary hover:bg-primary-50"
        >
          <Share2 className="size-6" />
          Compartir
        </button>
      </DialogContent>
    </Dialog>
  );
}
