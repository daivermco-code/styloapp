import { PageSkeleton } from "@/shared/components/page-skeleton";

// Cargando de la app del negocio y del equipo: todas sus pantallas piden la sesión y los datos en
// el servidor. El menú lateral del computador (layout) queda quieto; cambia solo el contenido.
export default function ProLoading() {
  return <PageSkeleton />;
}
