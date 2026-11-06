import type { Metadata } from "next";
import { requireOwner } from "@/features/business/services/queries";
import { PaymentList } from "@/features/payroll/components/payment-list";
import { getPayments } from "@/features/payroll/services/queries";
import { TopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Historial de pagos" };

// Historial de pagos del dueño (T-9.3.1, US-046). Al profesional, requireOwner lo manda al
// inicio, y la RLS de staff_payments lo repite.
export default async function PaymentsPage() {
  const owner = await requireOwner("/pro/pagos");
  const payments = await getPayments(owner.business.id);
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <TopBar title="Historial de pagos" backHref="/pro" />
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col pt-4">
        <PaymentList payments={payments} />
      </main>
    </div>
  );
}
