import type { Metadata } from "next";
import { requireOwner } from "@/features/business/services/queries";
import { ExpenseEditorPage } from "@/features/expenses/components/expense-editor-page";

export const metadata: Metadata = { title: "Agregar gasto" };

// Gasto nuevo (T-9.1.1, US-044). Solo el dueño.
export default async function NewExpensePage() {
  const owner = await requireOwner("/pro/gastos/nuevo");
  return <ExpenseEditorPage businessId={owner.business.id} expense={null} />;
}
