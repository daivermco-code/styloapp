// Gastos del negocio (US-044, pantalla 11). Las categorías son las del enum de la base
// (`expense_category`), en el orden y con los nombres de la historia.

export const EXPENSE_CATEGORIES = [
  "rent",
  "utilities",
  "payroll",
  "supplies",
  "maintenance",
  "advertising",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: "Arriendo",
  utilities: "Servicios públicos",
  payroll: "Nómina",
  supplies: "Insumos",
  maintenance: "Mantenimiento",
  advertising: "Publicidad",
  other: "Otros",
};

export interface Expense {
  id: string;
  name: string;
  category: ExpenseCategory;
  /** "YYYY-MM-DD". */
  paidOn: string;
  /** Pesos enteros, mayor que 0. */
  amount: number;
  paymentMethodId: string | null;
}

/** Una fila de la lista: el gasto con el nombre de su método. */
export interface ExpenseListItem extends Expense {
  methodName: string | null;
}
