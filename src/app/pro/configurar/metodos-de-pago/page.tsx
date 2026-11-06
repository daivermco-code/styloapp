import type { Metadata } from "next";
import { PaymentMethods } from "@/features/business/components/payment-methods";
import {
  getPaymentMethods,
  requireOwner,
} from "@/features/business/services/queries";
import { TopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Métodos de pago" };

// Métodos de pago (T-7.3.3, US-039, pantalla 16): con los que te pagan las facturas y pagas los
// gastos. Solo el dueño; el negocio nace con Efectivo y Banco.
export default async function PaymentMethodsPage() {
  const owner = await requireOwner("/pro/configurar/metodos-de-pago");
  const methods = await getPaymentMethods(owner.business.id);

  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title="Métodos de pago" backHref="/pro/configurar" />
      <main className="mx-auto flex max-w-[720px] flex-col gap-4 px-5 pb-28 pt-5 md:px-6">
        <p className="text-14 text-slate">
          Los que están activos salen al facturar y al anotar un gasto. Las
          facturas viejas guardan el suyo aunque lo desactives.
        </p>
        <PaymentMethods methods={methods} />
      </main>
    </div>
  );
}
