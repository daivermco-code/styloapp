import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CodeForm } from "@/features/auth/components/code-form";
import { safeNext } from "@/features/auth/services/destination";
import { getLoginPhone } from "@/features/auth/services/login-code";
import { TopBar } from "@/shared/components/top-bar";
import { formatPhone } from "@/shared/lib/phone";

export const metadata: Metadata = { title: "Confirma tu número" };

interface CodigoPageProps {
  searchParams: Promise<{ siguiente?: string | string[] }>;
}

// Paso 2 de entrar (US-003). El celular viene de la cookie que dejó "Enviar código"; sin ella,
// vuelve al paso 1.
export default async function CodigoPage({ searchParams }: CodigoPageProps) {
  const params = await searchParams;
  const next = safeNext(
    typeof params.siguiente === "string" ? params.siguiente : null,
  );
  const backHref = next
    ? `/entrar?siguiente=${encodeURIComponent(next)}`
    : "/entrar";
  const phone = await getLoginPhone();
  if (!phone) redirect(backHref);

  return (
    <>
      <TopBar title="Confirma tu número" backHref={backHref} />
      <main className="px-4 py-6">
        <CodeForm
          phoneLabel={formatPhone(phone)}
          next={next}
          backHref={backHref}
        />
      </main>
    </>
  );
}
