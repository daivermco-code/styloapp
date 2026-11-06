"use client";

import { QrCode, Settings, Share2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { BusinessQrDialog } from "@/features/business/components/business-qr-dialog";
import { useShareLink } from "@/features/business/hooks/use-business-link";
import type { StaffSide } from "../types/home";
import { SOON_MESSAGE } from "./module-list";

const ICON_BUTTON =
  "flex size-11 items-center justify-center rounded-full text-primary transition-colors duration-120 hover:bg-primary-50";

// Fila de arriba del inicio (US-006): la pastilla del plan (la suscripción es de una oleada
// futura) y compartir enlace, QR y configurar. El engranaje del profesional lleva a su cuenta.
export function HomeActions({ side, slug }: { side: StaffSide; slug: string }) {
  const share = useShareLink(slug);
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => toast(SOON_MESSAGE, { id: "pronto" })}
        className="flex h-11 items-center"
      >
        <span className="flex h-[26px] items-center rounded-full bg-secondary px-3 text-12 font-bold text-secondary-foreground">
          {side === "owner" ? "Plan Demo" : "Suscribirme"}
        </span>
      </button>
      <div className="-mr-2 flex items-center">
        <button
          type="button"
          onClick={() => void share()}
          aria-label="Compartir enlace del negocio"
          className={ICON_BUTTON}
        >
          <Share2 className="size-[25px]" strokeWidth={1.8} />
        </button>
        <BusinessQrDialog
          slug={slug}
          trigger={
            <button
              type="button"
              aria-label="Código QR del negocio"
              className={ICON_BUTTON}
            >
              <QrCode className="size-[25px]" strokeWidth={1.8} />
            </button>
          }
        />
        <Link
          href={side === "owner" ? "/pro/configurar" : "/pro/configurar/cuenta"}
          aria-label={
            side === "owner" ? "Configurar negocio" : "Configurar cuenta"
          }
          className={ICON_BUTTON}
        >
          <Settings className="size-[25px]" strokeWidth={1.8} />
        </Link>
      </div>
    </div>
  );
}
