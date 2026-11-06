import { SquarePen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/features/business/services/queries";
import {
  ClientProfile,
  toProfileTab,
} from "@/features/clients/components/client-profile";
import { clientNumbers } from "@/features/clients/lib/profile";
import {
  getClientBookings,
  getClientInvoices,
  getClientProfile,
} from "@/features/clients/services/queries";
import { TopBar } from "@/shared/components/top-bar";
import { todayInBogota } from "@/shared/lib/dates";

export const metadata: Metadata = { title: "Ficha del cliente" };

// Ficha del cliente (T-10.1.3, US-048, pantalla 15). Solo el dueño: requireOwner manda al
// profesional al inicio, y la RLS no le deja leer las facturas. La pestaña va en ?pestana=.
export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pestana?: string | string[] }>;
}) {
  const [{ id }, { pestana }] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const owner = await requireOwner(`/pro/clientes/${id}`);
  const businessId = owner.business.id;
  const [profile, bookings, invoices] = await Promise.all([
    getClientProfile(businessId, id),
    getClientBookings(businessId, id),
    getClientInvoices(businessId, id),
  ]);
  if (!profile) notFound();

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <TopBar
        title={profile.fullName}
        backHref="/pro/clientes"
        actions={
          <Link
            href={`/pro/clientes/${id}/editar`}
            aria-label="Editar cliente"
            className="flex size-11 items-center justify-center rounded-full text-primary hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SquarePen aria-hidden className="size-6" />
          </Link>
        }
      />
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 pt-4">
        <ClientProfile
          profile={profile}
          numbers={clientNumbers(bookings, invoices, todayInBogota())}
          bookings={bookings}
          invoices={invoices}
          tab={toProfileTab(pestana)}
        />
      </main>
    </div>
  );
}
