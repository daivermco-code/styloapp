export const AUDIENCES = ["male", "female", "unisex"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const PRICE_TYPES = ["fixed", "from", "range"] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  male: "Hombre",
  female: "Mujer",
  unisex: "Unisex",
};

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  fixed: "Fijo",
  from: "Desde",
  range: "Rango",
};

export interface Category {
  id: string;
  name: string;
}

export interface Service {
  id: string;
  categoryId: string;
  name: string;
  audience: Audience;
  description: string | null;
  durationMinutes: number;
  priceType: PriceType;
  price: number;
  priceTo: number | null;
  isActive: boolean;
}

export interface CatalogCategory extends Category {
  services: Service[];
}
