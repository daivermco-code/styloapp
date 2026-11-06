import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import {
  getPaymentMethods,
  requireOwner,
} from "@/features/business/services/queries";
import {
  PayrollDetail,
  PayrollDetailSkeleton,
} from "@/features/payroll/components/payroll-detail";
import {
  PayrollList,
  PayrollListSkeleton,
} from "@/features/payroll/components/payroll-list";
import {
  getPayroll,
  getPayrollDetail,
} from "@/features/payroll/services/queries";
import { TopBar } from "@/shared/components/top-bar";
import { todayInBogota } from "@/shared/lib/dates";
import { PendingArea } from "@/shared/components/instant-nav";
import { NAV_GROUP } from "@/shared/lib/instant-nav";

export const metadata: Metadata = { title: "Liquidador" };

async function PayrollCards({ businessId }: { businessId: string }) {
  return <PayrollList rows={await getPayroll(businessId)} />;
}

/** La hoja de un profesional; uno que no es del equipo (o el dueño) no abre nada. */
async function StaffSheet({
  businessId,
  staffId,
}: {
  businessId: string;
  staffId: string;
}) {
  const [detail, methods] = await Promise.all([
    getPayrollDetail(businessId, staffId),
    getPaymentMethods(businessId),
  ]);
  if (!detail) return null;
  return (
    <PayrollDetail
      detail={detail}
      methods={methods.filter((method) => method.isActive)}
      today={todayInBogota()}
    />
  );
}

// Liquidador del dueño (T-9.2.1 y T-9.2.2, US-045, pantalla 12). ?pro=<id> abre el detalle de ese
// profesional encima de la lista. Mientras llegan, la lista sale en esqueleto. Al profesional,
// requireOwner lo manda al inicio, y payroll() le devuelve 0 filas.
export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ pro?: string }>;
}) {
  const owner = await requireOwner("/pro/liquidador");
  const businessId = owner.business.id;
  const { pro } = await searchParams;
  const staffId = z.uuid().safeParse(pro).success ? pro : undefined;

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <TopBar title="Liquidador" icon={<Wallet />} backHref="/pro" />
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 px-5 pt-4 md:px-6">
        <p className="text-14 text-slate">
          Lo que le debes a cada profesional por las comisiones de sus facturas
          pagadas.
        </p>
        <Suspense fallback={<PayrollListSkeleton />}>
          <PayrollCards businessId={businessId} />
        </Suspense>
      </main>
      {/* La hoja se abre al tocar la tarjeta, en esqueleto hasta que llega (Fase 17). */}
      <PendingArea
        groups={[NAV_GROUP.payroll]}
        fallback={<PayrollDetailSkeleton />}
      >
        {staffId && (
          <Suspense key={staffId} fallback={<PayrollDetailSkeleton />}>
            <StaffSheet businessId={businessId} staffId={staffId} />
          </Suspense>
        )}
      </PendingArea>
    </div>
  );
}
