"use client";

import { CircleCheck, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentMethod } from "@/features/business/types/payment";
import { FieldBox } from "@/shared/components/field-box";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { MoneyInput } from "@/shared/components/money-input";
import { expensesHref } from "../lib/view";
import { saveExpense } from "../services/actions";
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  type Expense,
} from "../types/expense";
import { saveExpenseSchema } from "../types/schemas";
import { DeleteExpenseButton } from "./delete-expense-button";

type Field = "name" | "category" | "paidOn" | "amount" | "paymentMethodId";

const FIELD_LABELS: Record<Field, string> = {
  name: "Nombre",
  category: "Categoría",
  paidOn: "Fecha de pago",
  amount: "Valor del gasto",
  paymentMethodId: "Método de pago",
};

/** El valor del Select para "sin método" (Radix no deja opciones vacías). */
const NO_METHOD = "ninguno";

const NO_METHOD_LABEL = "Sin método de pago";

function methodName(method: PaymentMethod): string {
  return method.isActive ? method.name : `${method.name} (inactivo)`;
}

function methodLabel(methods: PaymentMethod[], id: string): string {
  const method = methods.find((option) => option.id === id);
  return method ? methodName(method) : NO_METHOD_LABEL;
}

interface Values {
  name: string;
  category: string;
  paidOn: string;
  amount: number | null;
  paymentMethodId: string;
}

function initialValues(expense: Expense | null, today: string): Values {
  return {
    name: expense?.name ?? "",
    category: expense?.category ?? "",
    paidOn: expense?.paidOn ?? today,
    amount: expense?.amount ?? null,
    paymentMethodId: expense?.paymentMethodId ?? NO_METHOD,
  };
}

interface ExpenseFormProps {
  expense: Expense | null;
  /** Activos, más el del gasto si se desactivó después. */
  methods: PaymentMethod[];
  /** Hoy en Bogotá ("YYYY-MM-DD"): la fecha de siempre y la más tardía. */
  today: string;
}

// Editor de gastos (T-9.1.1, US-044, pantalla 11, captura 55): nombre, categoría, fecha de pago,
// valor y método (opcional). Con un dato obligatorio vacío el botón queda apagado y dice qué falta;
// el campo lo dice al salir de él. Al editar, debajo va "Borrar gasto".
export function ExpenseForm({ expense, methods, today }: ExpenseFormProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [values, setValues] = useState(() => initialValues(expense, today));
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [serverError, setServerError] = useState<{
    field?: string;
    message: string;
  } | null>(null);
  const [pending, startTransition] = useActionTransition();

  const check = saveExpenseSchema(today).safeParse({
    expenseId: expense?.id,
    name: values.name,
    category: values.category || undefined,
    paidOn: values.paidOn || undefined,
    amount: values.amount ?? undefined,
    paymentMethodId:
      values.paymentMethodId === NO_METHOD ? undefined : values.paymentMethodId,
  });
  const issues: Partial<Record<Field, string>> = {};
  if (!check.success) {
    for (const issue of check.error.issues) {
      const field = issue.path[0] as Field;
      issues[field] ??= issue.message;
    }
  }
  const errorOf = (field: Field) =>
    (serverError?.field === field ? serverError.message : undefined) ??
    (touched[field] ? issues[field] : undefined);
  const describedBy = (field: Field) =>
    errorOf(field) ? `${field}-error` : undefined;
  const missing = (Object.keys(issues) as Field[]).map(
    (field) => FIELD_LABELS[field],
  );

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setServerError(null);
  };
  const touch = (field: Field) =>
    setTouched((current) => ({ ...current, [field]: true }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!check.success) return;
    startTransition(async () => {
      const result = await saveExpense(check.data);
      if (!result.ok) {
        setServerError(result.error);
        if (result.error.field) touch(result.error.field as Field);
        return;
      }
      toast.success(
        result.data.created ? "Gasto agregado." : "Cambios guardados.",
      );
      // Vuelve al mes del gasto, para verlo en la lista con el total.
      // replace: Atrás desde la lista no vuelve al editor con los datos de antes.
      router.replace(expensesHref({ period: "mes", day: check.data.paidOn }));
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <p className="text-14 text-slate">Los campos con * son obligatorios.</p>

        <FieldBox id="name" label="Nombre" required error={errorOf("name")}>
          <Input
            id="name"
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            onBlur={() => touch("name")}
            readOnly={!hydrated}
            maxLength={60}
            placeholder="Ej. Arriendo de noviembre"
            aria-required
            aria-invalid={errorOf("name") ? true : undefined}
            aria-describedby={describedBy("name")}
          />
        </FieldBox>

        <FieldBox
          id="category"
          label="Categoría"
          required
          error={errorOf("category")}
        >
          <Select
            value={values.category}
            onValueChange={(value) => set("category", value)}
            onOpenChange={(open) => !open && touch("category")}
            disabled={!hydrated}
          >
            <SelectTrigger
              id="category"
              aria-required
              aria-invalid={errorOf("category") ? true : undefined}
              aria-describedby={describedBy("category")}
            >
              <SelectValue placeholder="Elige una opción" />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldBox>

        <FieldBox
          id="paidOn"
          label="Fecha de pago"
          required
          error={errorOf("paidOn")}
        >
          <Input
            id="paidOn"
            type="date"
            max={today}
            value={values.paidOn}
            aria-required
            onChange={(event) => {
              // Del calendario se elige sin escribir: el error sale de una vez, no al salir.
              set("paidOn", event.target.value);
              touch("paidOn");
            }}
            onBlur={() => touch("paidOn")}
            readOnly={!hydrated}
            aria-invalid={errorOf("paidOn") ? true : undefined}
            aria-describedby={describedBy("paidOn")}
          />
        </FieldBox>

        <FieldBox
          id="amount"
          label="Valor del gasto"
          required
          error={errorOf("amount")}
        >
          <MoneyInput
            id="amount"
            value={values.amount}
            onChange={(value) => set("amount", value)}
            onBlur={() => touch("amount")}
            required
            disabled={!hydrated}
            invalid={!!errorOf("amount")}
            aria-describedby={describedBy("amount")}
          />
        </FieldBox>

        <FieldBox
          id="paymentMethodId"
          label="Método de pago"
          error={errorOf("paymentMethodId")}
        >
          <Select
            value={values.paymentMethodId}
            onValueChange={(value) => set("paymentMethodId", value)}
            disabled={!hydrated}
          >
            <SelectTrigger
              id="paymentMethodId"
              aria-invalid={errorOf("paymentMethodId") ? true : undefined}
              aria-describedby={describedBy("paymentMethodId")}
            >
              {/* El texto va dado: así se ve desde el primer pintado, antes de hidratar. */}
              <SelectValue>
                {methodLabel(methods, values.paymentMethodId)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_METHOD}>{NO_METHOD_LABEL}</SelectItem>
              {methods.map((method) => (
                <SelectItem key={method.id} value={method.id}>
                  {methodName(method)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldBox>

        {serverError && !serverError.field && (
          <p role="alert" className="text-14 text-danger">
            {serverError.message}
          </p>
        )}
        <div className="flex flex-col items-center gap-2 pt-2">
          {/* DESIGN.md: lo que falta va encima del botón desactivado, en 12 px rojo. */}
          {missing.length > 0 && (
            <p className="text-center text-12 text-danger">
              Falta: {missing.join(", ")}.
            </p>
          )}
          <Button
            type="submit"
            disabled={!hydrated || !check.success || pending}
            className="w-full md:w-[320px]"
          >
            {pending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <CircleCheck />
            )}
            {pending
              ? "Guardando…"
              : expense
                ? "Guardar cambios"
                : "Agregar gasto"}
          </Button>
        </div>
      </form>
      {expense && <DeleteExpenseButton expense={expense} disabled={pending} />}
    </div>
  );
}
