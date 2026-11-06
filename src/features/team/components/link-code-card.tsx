"use client";

import { Copy, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { QrImage } from "@/features/business/components/qr-image";
import { useOrigin } from "@/features/business/hooks/use-business-link";
import { copyText } from "@/shared/lib/clipboard";

// Código de vinculación del negocio y su QR (US-012). El QR abre "Vincularme a un negocio" con
// el código ya escrito; en la demo no se lee con la cámara, pero sirve si se escanea.
export function LinkCodeCard({ code }: { code: string }) {
  const origin = useOrigin();
  const link = origin ? `${origin}/pro/vincularme?codigo=${code}` : "";

  const copy = async () => {
    if (await copyText(code)) {
      toast.success("Código copiado");
      return;
    }
    toast.error("No se pudo copiar el código. Inténtalo de nuevo.");
  };

  return (
    <section
      aria-labelledby="codigo"
      className="flex flex-col items-center gap-3 rounded-card bg-primary-50 px-4 py-5 text-center"
    >
      <h2 id="codigo" className="text-16 font-bold text-secondary">
        Código para vincular profesionales
      </h2>
      <p
        aria-label={`Código: ${code.split("").join(" ")}`}
        className="pl-[0.3em] text-30 font-bold tracking-[0.3em] text-primary"
      >
        {code}
      </p>
      <p className="max-w-[420px] text-14 text-slate">
        El profesional entra a StyloApp con su celular, toca &ldquo;Vincularme a
        un negocio&rdquo; y escribe este código.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void copy()}
        >
          <Copy />
          Copiar código
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <QrCode />
              Código QR
            </Button>
          </DialogTrigger>
          <DialogContent className="justify-items-center gap-6 px-6 py-16 text-center">
            <DialogTitle className="sr-only">
              Código QR para vincular profesionales
            </DialogTitle>
            <DialogDescription className="text-16 text-ink">
              Muéstrale este código al profesional para que se vincule a tu
              negocio.
            </DialogDescription>
            <QrImage
              value={link}
              size={144}
              label={`Código QR para vincularse con el código ${code}`}
            />
            <p className="pl-[0.3em] text-25 font-bold tracking-[0.3em] text-primary">
              {code}
            </p>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
