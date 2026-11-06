import Image from "next/image";
import { cn } from "@/lib/utils";

interface BusinessLogoProps {
  name: string;
  logoUrl: string | null;
  /** Lado en px. */
  size: number;
  className?: string;
}

// Logo redondo del negocio: la ilustración de la demo (public/demo/logos) o, si no tiene, su
// inicial sobre el principal, como en el diseño.
export function BusinessLogo({
  name,
  logoUrl,
  size,
  className,
}: BusinessLogoProps) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-surface",
        className,
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
