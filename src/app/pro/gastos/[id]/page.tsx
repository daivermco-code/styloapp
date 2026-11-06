import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/features/business/services/queries";
import { ExpenseEditorPage } from "@/features/expenses/components/expense-editor-page";
import { getExpense } from "@/features/expenses/services/queries";

export const metadata: Metadata = { title: "Editar gasto" };

// Editar o borrar un gasto (T-9.1.1, US-044). Solo el dueño; uno de otro negocio no existe.
export default async function ExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const owner = await requireOwner(`/pro/gastos/${id}`);
  const expense = await getExpense(owner.business.id, id);
  if (!expense) notFound();
  return <ExpenseEditorPage businessId={owner.business.id} expense={expense} />;
}
