import type {
  BookingCategoryOption,
  BookingServiceOption,
} from "@/features/agenda/types/agenda";

/** Sin tildes ni mayúsculas, para buscar "candelaria" y encontrar "La Candelaria". */
export function plainText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Los servicios cuyo nombre tiene la búsqueda, sin las categorías que quedan vacías. */
export function filterServices(
  categories: BookingCategoryOption[],
  query: string,
): BookingCategoryOption[] {
  const wanted = plainText(query);
  if (!wanted) return categories;
  return categories
    .map((category) => ({
      ...category,
      services: category.services.filter((service) =>
        plainText(service.name).includes(wanted),
      ),
    }))
    .filter((category) => category.services.length > 0);
}

/** El servicio con ese id en el catálogo, o null. */
export function findService(
  categories: BookingCategoryOption[],
  id: string | null,
): BookingServiceOption | null {
  for (const category of categories) {
    const service = category.services.find((item) => item.id === id);
    if (service) return service;
  }
  return null;
}
