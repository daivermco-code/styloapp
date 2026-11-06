import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/features/auth/components/profile-form";
import { safeNext } from "@/features/auth/services/destination";
import { GENDERS } from "@/features/auth/types/schemas";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/shared/components/top-bar";
import { todayInBogota } from "@/shared/lib/dates";

export const metadata: Metadata = { title: "Completa tu perfil" };

interface PerfilPageProps {
  searchParams: Promise<{ siguiente?: string | string[] }>;
}

function isGender(value: unknown): value is (typeof GENDERS)[number] {
  return GENDERS.some((gender) => gender === value);
}

// Después del primer código (US-003): una cuenta nueva no tiene nombre todavía.
export default async function PerfilPage({ searchParams }: PerfilPageProps) {
  const params = await searchParams;
  const next = safeNext(
    typeof params.siguiente === "string" ? params.siguiente : null,
  );
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, gender, birth_date")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <>
      <TopBar title="Completa tu perfil" />
      <main className="flex flex-col gap-6 px-4 py-6">
        <p className="text-16 text-ink">
          Así te van a ver el negocio y el equipo cuando reserves o trabajes.
        </p>
        <ProfileForm
          defaultName={profile?.full_name ?? ""}
          defaultGender={isGender(profile?.gender) ? profile.gender : null}
          defaultBirthDate={profile?.birth_date ?? null}
          today={todayInBogota()}
          next={next}
        />
      </main>
    </>
  );
}
