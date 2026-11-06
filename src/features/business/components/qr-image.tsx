"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface QrImageProps {
  /** Lo que lleva el QR: el enlace del negocio o el código de vinculación. */
  value: string;
  /** Lado en píxeles. */
  size: number;
  label: string;
  className?: string;
}

// QR generado en el navegador (US-008 y US-012), en petróleo profundo sobre blanco hueso.
export function QrImage({ value, size, label, className }: QrImageProps) {
  const [image, setImage] = useState<{ value: string; url: string } | null>(
    null,
  );

  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    QRCode.toDataURL(value, {
      margin: 1,
      width: size * 2,
      color: { dark: "#0B3F45", light: "#FCFEFE" },
    })
      .then((url) => {
        if (!cancelled) setImage({ value, url });
      })
      .catch((error: unknown) => console.error("[QrImage]", error));
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!image || image.value !== value) {
    return (
      <Skeleton
        className={cn("rounded-md", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    // Es una imagen generada al momento (data URL): next/image no aporta nada aquí.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.url}
      alt={label}
      width={size}
      height={size}
      className={className}
    />
  );
}
