import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Audience,
  CatalogCategory,
  PriceType,
  Service,
} from "../types/catalog";

const SERVICE_COLUMNS =
  "id, category_id, name, audience, description, duration_minutes, price_type, price, price_to, is_active";

interface ServiceRow {
  id: string;
  category_id: string;
  name: string;
  audience: string;
  description: string | null;
  duration_minutes: number;
  price_type: PriceType;
  price: number;
  price_to: number | null;
  is_active: boolean;
}

function toService(row: ServiceRow): Service {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    audience: row.audience as Audience,
    description: row.description,
    durationMinutes: row.duration_minutes,
    priceType: row.price_type,
    price: row.price,
    priceTo: row.price_to,
    isActive: row.is_active,
  };
}

/** Las categorías del negocio en su orden, cada una con todos sus servicios (activos y archivados). */
export async function getCatalog(
  businessId: string,
): Promise<CatalogCategory[]> {
  const supabase = await createClient();
  const [{ data: categories }, { data: services }] = await Promise.all([
    supabase
      .from("service_categories")
      .select("id, name")
      .eq("business_id", businessId)
      .order("position")
      .order("name"),
    supabase
      .from("services")
      .select(SERVICE_COLUMNS)
      .eq("business_id", businessId)
      .order("position")
      .order("name"),
  ]);
  return (categories ?? []).map((category) => ({
    ...category,
    services: (services ?? [])
      .filter((service) => service.category_id === category.id)
      .map(toService),
  }));
}

export async function getService(
  businessId: string,
  serviceId: string,
): Promise<Service | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select(SERVICE_COLUMNS)
    .eq("business_id", businessId)
    .eq("id", serviceId)
    .maybeSingle();
  return data ? toService(data) : null;
}
