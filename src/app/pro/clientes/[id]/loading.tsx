import { PageSkeleton } from "@/shared/components/page-skeleton";

// Cargando al pasar a una subpágina de esta sección (Fase 17): el de /pro solo sale al cambiar de
// sección, y sin este la pantalla se queda quieta hasta que llega la nueva.
export default function Loading() {
  return <PageSkeleton />;
}
