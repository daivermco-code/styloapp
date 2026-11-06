import { formatCOP } from "@/shared/lib/money";
import type { Service } from "../types/catalog";

/** "$ 25.000", "Desde $ 25.000" o "$ 25.000 – $ 40.000". */
export function formatServicePrice(
  service: Pick<Service, "priceType" | "price" | "priceTo">,
): string {
  if (service.priceType === "from") return `Desde ${formatCOP(service.price)}`;
  if (service.priceType === "range" && service.priceTo !== null) {
    return `${formatCOP(service.price)} – ${formatCOP(service.priceTo)}`;
  }
  return formatCOP(service.price);
}
