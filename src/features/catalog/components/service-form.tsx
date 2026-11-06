"use client";

import { CircleCheck, LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
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
import { cn } from "@/lib/utils";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { formatMinutes } from "@/shared/lib/duration";
import { formatCOP } from "@/shared/lib/money";
import { saveService } from "../services/actions";
import {
  AUDIENCE_LABELS,
  AUDIENCES,
  type Category,
  PRICE_TYPE_LABELS,
  PRICE_TYPES,
  type PriceType,
  type Service,
} from "../types/catalog";
import { serviceSchema } from "../types/schemas";
import { CategoryDialog } from "./category-dialog";

type Field =
  | "name"
  | "categoryId"
  | "audience"
  | "description"
  | "durationMinutes"
  | "price"
  | "priceTo";

const FIELD_LABELS: Record<Field, string> = {
  name: "Nombre",
  categoryId: "Categoría",
  audience: "Para quién",
  description: "Descripción",
  durationMinutes: "Duración",
  price: "Precio",
  priceTo: "Precio final",
};

interface Values {
  name: string;
  categoryId: string;
  audience: string;
  description: string;
  /** Solo dígitos. */
  duration: string;
  priceType: PriceType;
  /** Solo dígitos. */
  price: string;
  priceTo: string;
}

function initialValues(service: Service | null): Values {
  return {
    name: service?.name ?? "",
    categoryId: service?.categoryId ?? "",
    audience: service?.audience ?? "",
    description: service?.description ?? "",
    duration: String(service?.durationMinutes ?? 30),
    priceType: service?.priceType ?? "fixed",
    price: service ? String(service.price) : "",
    priceTo: service?.priceTo != null ? String(service.priceTo) : "",
  };
}

const digits = (value: string) => value.replace(/\D/g, "");
const toNumber = (value: string) => (value === "" ? undefined : Number(value));
/** "25000" → "25.000" para mostrarlo mientras se escribe. */
const asPesos = (value: string) =>
  value === "" ? "" : formatCOP(Number(value)).slice(2);

interface FieldBoxProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

function FieldBox({
  id,
  label,
  required,
  hint,
  error,
  children,
}: FieldBoxProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-14 font-bold text-ink">
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
        {hint && <p className="text-14 text-slate">{hint}</p>}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-14 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function PesosInput({
  id,
  value,
  invalid,
  onChange,
  onBlur,
  label,
}: {
  id: string;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
  label?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-16 font-bold text-slate">
        $
      </span>
      <Input
        id={id}
        inputMode="numeric"
        value={asPesos(value)}
        onChange={(event) => onChange(digits(event.target.value).slice(0, 9))}
        onBlur={onBlur}
        aria-label={label}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className="pl-9 focus-visible:pl-[35px]"
      />
    </div>
  );
}

interface ServiceFormProps {
  service: Service | null;
  categories: Category[];
}

// Editor de servicio (T-2.3.2, US-011, capturas 52 y 53). Con un dato obligatorio vacío el botón
// queda apagado y dice qué falta; el campo lo dice al salir de él.
export function ServiceForm({
  service,
  categories: initialCategories,
}: ServiceFormProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [values, setValues] = useState(() => initialValues(service));
  const [categories, setCategories] = useState(initialCategories);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [serverError, setServerError] = useState<{
    field?: string;
    message: string;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useActionTransition();

  const check = serviceSchema.safeParse({
    id: service?.id,
    name: values.name,
    categoryId: values.categoryId,
    audience: values.audience || undefined,
    description: values.description,
    durationMinutes: toNumber(values.duration),
    priceType: values.priceType,
    price: toNumber(values.price),
    priceTo:
      values.priceType === "range" ? (toNumber(values.priceTo) ?? null) : null,
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
  const missing = (Object.keys(issues) as Field[]).map(
    (field) => FIELD_LABELS[field],
  );

  const set = (key: keyof Values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setServerError(null);
  };
  const touch = (field: Field) =>
    setTouched((current) => ({ ...current, [field]: true }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!check.success) return;
    startTransition(async () => {
      const result = await saveService(check.data);
      if (!result.ok) {
        setServerError(result.error);
        if (result.error.field) touch(result.error.field as Field);
        return;
      }
      toast.success(
        result.data.created
          ? "Servicio creado. Asígnalo a tu equipo en Equipo."
          : "Cambios guardados",
      );
      router.push(
        service && !service.isActive
          ? "/pro/servicios?pestana=archivados"
          : "/pro/servicios",
      );
    });
  };

  const noCategories = categories.length === 0;

  return (
    <>
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
            placeholder="Ej. Corte con barba"
            aria-invalid={errorOf("name") ? true : undefined}
            aria-describedby={errorOf("name") ? "name-error" : undefined}
          />
        </FieldBox>

        <FieldBox
          id="categoryId"
          label="Categoría"
          required
          hint={
            noCategories
              ? "Todavía no tienes categorías: crea una primero."
              : undefined
          }
          error={errorOf("categoryId")}
        >
          <div className="flex gap-2">
            <Select
              value={values.categoryId || undefined}
              onValueChange={(value) => set("categoryId", value)}
              onOpenChange={(open) => !open && touch("categoryId")}
              disabled={noCategories}
            >
              <SelectTrigger
                id="categoryId"
                aria-invalid={errorOf("categoryId") ? true : undefined}
                className="min-w-0 flex-1"
              >
                <SelectValue
                  placeholder={
                    noCategories ? "Sin categorías" : "Elige una categoría"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(true)}
              disabled={!hydrated}
              className={cn(
                "shrink-0 px-4",
                !hydrated && "disabled:bg-surface disabled:text-primary",
              )}
            >
              <Plus />
              Nueva
            </Button>
          </div>
        </FieldBox>

        <FieldBox
          id="audience"
          label="Para quién"
          required
          hint="¿Para cuál género es este servicio?"
          error={errorOf("audience")}
        >
          <Select
            value={values.audience || undefined}
            onValueChange={(value) => set("audience", value)}
            onOpenChange={(open) => !open && touch("audience")}
          >
            <SelectTrigger
              id="audience"
              aria-invalid={errorOf("audience") ? true : undefined}
            >
              <SelectValue placeholder="Elige uno" />
            </SelectTrigger>
            <SelectContent>
              {AUDIENCES.map((audience) => (
                <SelectItem key={audience} value={audience}>
                  {AUDIENCE_LABELS[audience]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldBox>

        <FieldBox
          id="description"
          label="Descripción"
          error={errorOf("description")}
        >
          <textarea
            id="description"
            value={values.description}
            onChange={(event) => set("description", event.target.value)}
            onBlur={() => touch("description")}
            readOnly={!hydrated}
            maxLength={300}
            rows={3}
            placeholder="Escribe detalles sobre el servicio"
            className="min-h-24 w-full resize-y rounded-card border border-input bg-surface px-4 py-3 text-16 text-ink placeholder:text-slate focus-visible:border-2 focus-visible:border-primary focus-visible:px-[15px] focus-visible:py-[11px] focus-visible:outline-none"
          />
          <p className="self-end text-12 text-slate">
            {values.description.length}/300
          </p>
        </FieldBox>

        <FieldBox
          id="durationMinutes"
          label="Duración del servicio"
          required
          error={errorOf("durationMinutes")}
        >
          <div className="flex items-center gap-3">
            <div className="relative w-32">
              <Input
                id="durationMinutes"
                inputMode="numeric"
                value={values.duration}
                onChange={(event) =>
                  set("duration", digits(event.target.value).slice(0, 3))
                }
                onBlur={() => touch("durationMinutes")}
                readOnly={!hydrated}
                aria-invalid={errorOf("durationMinutes") ? true : undefined}
                aria-describedby={
                  errorOf("durationMinutes")
                    ? "durationMinutes-error"
                    : undefined
                }
                className="pr-14"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-16 text-slate">
                min
              </span>
            </div>
            {Number(values.duration) >= 60 && !issues.durationMinutes && (
              <p className="text-16 text-slate">
                = {formatMinutes(Number(values.duration))}
              </p>
            )}
          </div>
        </FieldBox>

        <FieldBox
          id="price"
          label="Precio"
          required
          error={errorOf("price") ?? errorOf("priceTo")}
        >
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
            <Select
              value={values.priceType}
              onValueChange={(value) => set("priceType", value)}
            >
              <SelectTrigger aria-label="Tipo de precio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {PRICE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <PesosInput
              id="price"
              value={values.price}
              invalid={!!errorOf("price")}
              onChange={(value) => set("price", value)}
              onBlur={() => touch("price")}
              label={
                values.priceType === "range" ? "Precio inicial" : undefined
              }
            />
            {values.priceType === "range" && (
              <>
                <p className="flex items-center justify-end pr-1 text-16 text-slate">
                  hasta
                </p>
                <PesosInput
                  id="priceTo"
                  value={values.priceTo}
                  invalid={!!errorOf("priceTo")}
                  onChange={(value) => set("priceTo", value)}
                  onBlur={() => touch("priceTo")}
                  label="Precio final"
                />
              </>
            )}
          </div>
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
              : service
                ? "Guardar cambios"
                : "Crear servicio"}
          </Button>
        </div>
      </form>
      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(category) => {
          setCategories((current) => [...current, category]);
          set("categoryId", category.id);
          toast.success(`Categoría ${category.name} creada`);
        }}
      />
    </>
  );
}
