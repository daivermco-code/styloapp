"use client";

import { ChevronDown, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { formatCOP } from "@/shared/lib/money";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { saveStaffPricing } from "../services/actions";
import { COMMISSION_RANGE, PRICE_RANGE } from "../types/schemas";
import type { StaffPricingCategory } from "../types/team";

interface Row {
  /** Pesos escritos; vacío = el precio general. */
  price: string;
  /** Porcentaje escrito, con coma o punto. */
  commission: string;
}

type Rows = Record<string, Row>;

// El campo subrayado de la pantalla 18: estrecho, sin caja.
const UNDERLINED =
  "h-11 rounded-none border-0 border-b bg-transparent px-1 text-right focus-visible:border-0 focus-visible:border-b-2 focus-visible:px-1 placeholder:text-slate";

function initialRows(categories: StaffPricingCategory[]): Rows {
  return Object.fromEntries(
    categories.flatMap((category) =>
      category.services.map((service) => [
        service.id,
        {
          price: service.ownPrice === null ? "" : String(service.ownPrice),
          commission: String(service.commissionPct).replace(".", ","),
        },
      ]),
    ),
  );
}

function toPct(text: string): number {
  return Number(text.replace(",", "."));
}

/** Lo que se guardaría: "50", "050" y "50,0" son lo mismo. */
function rowValue(row: Row): string {
  return `${row.price === "" ? "" : Number(row.price)}|${toPct(row.commission)}`;
}

function rowError(row: Row): string | null {
  if (row.price !== "" && Number(row.price) > 100_000_000) return PRICE_RANGE;
  const pct = toPct(row.commission);
  if (
    row.commission === "" ||
    !/^\d{1,3}([.,]\d{1,2})?$/.test(row.commission) ||
    pct > 100
  ) {
    return COMMISSION_RANGE;
  }
  return null;
}

interface StaffPricingProps {
  staffId: string;
  name: string;
  categories: StaffPricingCategory[];
}

// Precio y comisión de un profesional (US-037, pantalla 18, captura 177): por cada servicio que
// hace, su precio (vacío = el general, en gris) y la comisión que se lleva (empieza en 50 %).
export function StaffPricing({ staffId, name, categories }: StaffPricingProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [initial] = useState(() => initialRows(categories));
  const [rows, setRows] = useState(initial);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useActionTransition();

  const changed = Object.keys(rows).filter(
    (id) => rowValue(rows[id]) !== rowValue(initial[id]),
  );
  const hasErrors = Object.values(rows).some(rowError);

  const update = (serviceId: string, change: Partial<Row>) => {
    setFormError(null);
    setRows((current) => ({
      ...current,
      [serviceId]: { ...current[serviceId], ...change },
    }));
  };

  const save = () => {
    startTransition(async () => {
      const result = await saveStaffPricing({
        staffId,
        rows: changed.map((serviceId) => ({
          serviceId,
          price:
            rows[serviceId].price === "" ? null : Number(rows[serviceId].price),
          commissionPct: toPct(rows[serviceId].commission),
        })),
      });
      if (!result.ok) {
        setFormError(result.error.message);
        return;
      }
      setFormError(null);
      toast.success("Precio y comisión guardados");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-20 font-bold text-primary">Precio y comisión</h2>
        <p className="text-14 text-slate">
          Elige el precio y la comisión de cada servicio con {name}. Vacío cobra
          el precio general.
        </p>
      </div>

      {categories.map((category) => (
        <details key={category.id} open className="group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 border-b border-stroke text-18 font-bold text-primary [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-5 transition-transform duration-120 group-open:rotate-180" />
            {category.name}
          </summary>
          <div
            aria-hidden="true"
            className="grid grid-cols-[1fr_104px_72px] gap-3 pt-3 text-12 font-medium text-slate"
          >
            <span>Servicio</span>
            <span className="text-right">Precio</span>
            <span className="text-right">Comisión</span>
          </div>
          <ul className="divide-y divide-line">
            {category.services.map((service) => {
              const row = rows[service.id];
              const error = rowError(row);
              return (
                <li key={service.id} className="flex flex-col gap-1 py-2">
                  <div className="grid grid-cols-[1fr_104px_72px] items-center gap-3">
                    <span className="min-w-0 text-16 text-ink">
                      {service.name}
                    </span>
                    <Input
                      value={row.price}
                      readOnly={!hydrated || pending}
                      onChange={(event) =>
                        update(service.id, {
                          price: event.target.value.replace(/\D/g, ""),
                        })
                      }
                      inputMode="numeric"
                      maxLength={9}
                      placeholder={formatCOP(service.generalPrice)}
                      aria-label={`Precio de ${service.name} con ${name}, en pesos`}
                      className={UNDERLINED}
                    />
                    <div className="flex items-center gap-1">
                      <Input
                        value={row.commission}
                        readOnly={!hydrated || pending}
                        onChange={(event) =>
                          update(service.id, {
                            commission: event.target.value.replace(
                              /[^\d.,]/g,
                              "",
                            ),
                          })
                        }
                        inputMode="decimal"
                        maxLength={6}
                        aria-label={`Comisión de ${name} en ${service.name}, en porcentaje`}
                        aria-invalid={error ? true : undefined}
                        className={UNDERLINED}
                      />
                      <span className="text-14 text-slate">%</span>
                    </div>
                  </div>
                  {error && (
                    <p role="alert" className="text-14 text-danger">
                      {service.name}: {error}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      ))}

      {formError && (
        <p role="alert" className="text-14 text-danger">
          {formError}
        </p>
      )}
      <Button
        type="button"
        onClick={save}
        disabled={!hydrated || changed.length === 0 || hasErrors || pending}
        className="mt-2 w-full self-center md:w-[320px]"
      >
        {pending && <LoaderCircle className="animate-spin" />}
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </div>
  );
}
