import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  /** Lado del monograma en px: 34 en barras, 55 en la pantalla de inicio. */
  size?: number;
  /** Muestra "StyloApp" al lado (logotipo) o solo el monograma. */
  withName?: boolean;
  className?: string;
}

// Monograma S con su punto (UI-styloapp.md §2) + "Stylo" Bold y "App" Medium en petróleo.
export function BrandLogo({
  size = 34,
  withName = true,
  className,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/brand/monograma.svg"
        alt={withName ? "" : "StyloApp"}
        width={size}
        height={size}
        priority
      />
      {withName && (
        <span className="text-18 text-primary">
          <span className="font-bold">Stylo</span>
          <span className="font-medium">App</span>
        </span>
      )}
    </span>
  );
}
