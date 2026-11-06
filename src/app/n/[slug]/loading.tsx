import { PageSkeleton } from "@/shared/components/page-skeleton";

// Cargando de la página por enlace del negocio, en su columna de 480 px.
export default function LinkLoading() {
  return <PageSkeleton className="max-w-[480px]" />;
}
