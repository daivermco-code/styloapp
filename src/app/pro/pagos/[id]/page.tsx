import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/features/business/services/queries";
import { PaymentDetail } from "@/features/payroll/components/payment-detail";
import { getPayment } from "@/features/payroll/services/queries";
import { TopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Detalle del pago" };

// Detalle de un pago al equipo (T-9.3.1, US-046). Solo el dueño; uno de otro negocio no existe.
export default async function PaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const owner = await requireOwner(`/pro/pagos/${id}`);
  const payment = await getPayment(owner.business.id, id);
  if (!payment) notFound();
  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title={`Pago a ${payment.staffName}`} backHref="/pro/pagos" />
      <main className="mx-auto flex max-w-[720px] flex-col px-5 pb-24 pt-6 md:px-6">
        <PaymentDetail payment={payment} />
      </main>
    </div>
  );
}
