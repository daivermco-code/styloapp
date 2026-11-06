import { PageSkeleton } from "@/shared/components/page-skeleton";

// Cargando de la app de clientes (Explorar, el negocio, Mis Reservas y lo demás): la barra de
// abajo y el menú lateral (layout) quedan quietos; cambia solo el contenido.
export default function ClientLoading() {
  return <PageSkeleton />;
}
