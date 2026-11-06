"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { saveTeamPermissions } from "../services/actions";
import type { TeamPermissions as Permissions } from "../types/team";

const ROWS: { key: keyof Permissions; title: string; hint: string }[] = [
  {
    key: "internalClients",
    title: "Crear clientes",
    hint: "Agregan clientes nuevos desde la agenda, con nombre y celular.",
  },
  {
    key: "invoicing",
    title: "Facturar",
    hint: "Cobran y facturan sus propias citas, y ven sus facturas.",
  },
  {
    key: "manualBooking",
    title: "Agendar citas",
    hint: "Ponen citas a mano en su agenda, además de las que reservan los clientes.",
  },
  {
    key: "manualBlock",
    title: "Bloquear horas",
    hint: "Cierran horas de su agenda para que nadie reserve en ellas.",
  },
  {
    key: "seeClientPhone",
    title: "Ver el celular de los clientes",
    hint: "Ven el número del cliente en cada cita que atienden.",
  },
];

// Permisos del equipo (US-038, pantalla 18, captura 179): cinco interruptores que valen para
// todos los profesionales. Cada cambio se guarda al tocarlo; si falla, vuelve a como estaba.
export function TeamPermissions({ initial }: { initial: Permissions }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useActionTransition();

  const toggle = (key: keyof Permissions, checked: boolean) => {
    const before = values;
    const next = { ...values, [key]: checked };
    setValues(next);
    startTransition(async () => {
      const result = await saveTeamPermissions(next);
      if (!result.ok) {
        setValues(before);
        toast.error(result.error.message);
        return;
      }
      const title = ROWS.find((row) => row.key === key)?.title ?? "";
      toast.success(`${title}: ${checked ? "encendido" : "apagado"}`);
      router.refresh();
    });
  };

  return (
    <ul className="divide-y divide-line">
      {ROWS.map((row) => {
        const id = `permiso-${row.key}`;
        return (
          <li key={row.key} className="flex items-center gap-4 py-4">
            <label
              htmlFor={id}
              className="flex min-w-0 flex-1 flex-col gap-0.5"
            >
              <span className="text-18 text-ink">{row.title}</span>
              <span className="text-13 text-slate">{row.hint}</span>
            </label>
            <Switch
              id={id}
              checked={values[row.key]}
              disabled={pending}
              onCheckedChange={(checked) => toggle(row.key, checked)}
            />
          </li>
        );
      })}
    </ul>
  );
}
