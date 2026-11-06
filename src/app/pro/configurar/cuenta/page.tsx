import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCurrentPerson } from "@/features/auth/services/queries";
import {
  StaffSettings,
  toStaffTab,
} from "@/features/team/components/staff-settings";
import { getMyStaff } from "@/features/team/services/queries";
import { TopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Configurar cuenta" };

const PATH = "/pro/configurar/cuenta";

// "Configurar cuenta" del profesional (T-2.4.3, US-014, capturas 158 y 171): solo sus datos, con
// dos pestañas, horario y servicios; el precio y la comisión no los ve.
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ pestana?: string }>;
}) {
  const person = await getCurrentPerson();
  if (!person) redirect(`/entrar?siguiente=${PATH}`);
  const staff = await getMyStaff(person.id);
  if (!staff) redirect("/pro/vincularme");
  const { pestana } = await searchParams;

  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title="Configurar cuenta" backHref="/pro" />
      <main className="mx-auto flex max-w-[720px] flex-col gap-4 px-5 pb-24 pt-4 md:px-6">
        <div className="flex flex-col items-center gap-1">
          <Avatar className="size-14 text-25 ring-[3px] ring-secondary ring-offset-2">
            <AvatarFallback>{staff.display_name.charAt(0)}</AvatarFallback>
          </Avatar>
          <p className="text-14 font-bold text-primary">{staff.display_name}</p>
        </div>
        <StaffSettings
          businessId={staff.businessId}
          staffId={staff.id}
          name={staff.display_name}
          tab={toStaffTab(pestana)}
          path={PATH}
          self
        />
      </main>
    </div>
  );
}
