import type { Metadata } from "next";
import { PhoneForm } from "@/features/auth/components/phone-form";
import { safeNext } from "@/features/auth/services/destination";
import { getLoginPhone } from "@/features/auth/services/login-code";
import { demoPersonaPhone } from "@/features/demo/services/queries";
import { TopBar } from "@/shared/components/top-bar";
import { localDigits } from "@/shared/lib/phone";

export const metadata: Metadata = { title: "Entrar" };

interface EntrarPageProps {
  searchParams: Promise<{
    persona?: string | string[];
    siguiente?: string | string[];
  }>;
}

function single(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

// Paso 1 de entrar (US-003). Con ?persona= llega desde el inicio de la demo con el celular escrito;
// al volver desde el código, trae el que se estaba usando.
export default async function EntrarPage({ searchParams }: EntrarPageProps) {
  const params = await searchParams;
  const persona = single(params.persona);
  const next = safeNext(single(params.siguiente));
  const phone =
    (persona ? await demoPersonaPhone(persona) : null) ??
    (await getLoginPhone());

  return (
    <>
      <TopBar title="Tu número de celular" backHref="/" />
      <main className="flex flex-col gap-6 px-4 py-6">
        <p className="text-16 text-ink">
          Te mandamos un código a la bandeja de la demo, como si fuera un
          mensaje de texto.
        </p>
        <PhoneForm
          defaultPhone={phone ? (localDigits(phone) ?? "") : ""}
          next={next}
        />
      </main>
    </>
  );
}
