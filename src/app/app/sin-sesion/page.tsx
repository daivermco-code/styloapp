import type { Metadata } from "next";
import { safeNext } from "@/features/auth/services/destination";
import { LoginPrompt } from "@/features/explore/components/login-prompt";
import { ClientTopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Mejora tu experiencia" };

interface SignedOutPageProps {
  searchParams: Promise<{ siguiente?: string | string[] }>;
}

// Lo personal de la app sin sesión (US-024 y US-028, captura 96). El proxy reescribe aquí Mis
// Reservas, Calificar, Mi reputación, Mis reseñas, Seguidos y Perfil, con la ruta pedida en
// ?siguiente= para volver a ella después de entrar.
export default async function SignedOutPage({
  searchParams,
}: SignedOutPageProps) {
  const params = await searchParams;
  const next =
    safeNext(typeof params.siguiente === "string" ? params.siguiente : null) ??
    "/app";
  return (
    <>
      <ClientTopBar title="Tu cuenta" />
      <main>
        <LoginPrompt next={next} />
      </main>
    </>
  );
}
