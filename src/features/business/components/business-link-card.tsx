"use client";

import { QrCode, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBusinessLink, useShareLink } from "../hooks/use-business-link";
import { BusinessQrDialog } from "./business-qr-dialog";

// "Compartir enlace" y "Código QR" del perfil del negocio (US-008): la dirección de la página de
// reservas a la vista, para saber qué se comparte.
export function BusinessLinkCard({ slug }: { slug: string }) {
  const link = useBusinessLink(slug);
  const share = useShareLink(slug);

  return (
    <section
      aria-labelledby="enlace"
      className="flex flex-col gap-3 rounded-card bg-primary-50 p-4"
    >
      <div className="flex flex-col gap-0.5">
        <h2 id="enlace" className="text-16 font-bold text-secondary">
          Página de reservas
        </h2>
        <p className="break-all text-14 text-slate">{link || `/n/${slug}`}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void share()}
        >
          <Share2 />
          Compartir enlace
        </Button>
        <BusinessQrDialog
          slug={slug}
          trigger={
            <Button type="button" variant="outline" size="sm">
              <QrCode />
              Código QR
            </Button>
          }
        />
      </div>
    </section>
  );
}
