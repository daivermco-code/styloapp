"use client";

import { LoaderCircle, Search, UserPlus, UserRoundX } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/shared/components/empty-state";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { formatPhone } from "@/shared/lib/phone";
import { createQuickClient } from "../services/actions";
import type { AgendaClient } from "../types/agenda";

// Para no pintar 80 filas de una: con el buscador se encuentra el resto.
const MAX_SHOWN = 30;

/** Sin tildes ni mayúsculas, para buscar "jose" y encontrar "José". */
function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function matches(client: AgendaClient, query: string): boolean {
  const words = plain(query).trim();
  if (words === "") return true;
  const digits = query.replace(/\D/g, "");
  if (digits.length >= 3 && client.phone?.replace(/\D/g, "").includes(digits)) {
    return true;
  }
  return plain(client.fullName).includes(words);
}

interface QuickClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (client: AgendaClient) => void;
}

// "Crear cliente" rápido (captura 62, en corto): nombre y, si se sabe, el celular.
function QuickClientDialog({
  open,
  onOpenChange,
  onCreated,
}: QuickClientDialogProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<{
    field?: string;
    message: string;
  } | null>(null);
  const [pending, startTransition] = useActionTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await createQuickClient({ fullName, phone });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated(result.data);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-6 px-6 pb-8 pt-12">
        <div className="flex flex-col gap-1 text-center">
          <DialogTitle className="text-18 font-bold text-primary">
            Crear cliente
          </DialogTitle>
          <DialogDescription className="text-14 text-slate">
            Queda en las fichas de tu negocio.
          </DialogDescription>
        </div>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="clientName" className="text-14 font-bold text-ink">
              Nombre <span aria-hidden="true">*</span>
            </label>
            <Input
              id="clientName"
              value={fullName}
              maxLength={80}
              autoComplete="off"
              onChange={(event) => setFullName(event.target.value)}
              aria-invalid={error?.field === "fullName" ? true : undefined}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="clientPhone" className="text-14 font-bold text-ink">
              Celular (opcional)
            </label>
            <div className="flex items-center gap-2">
              <span className="flex h-12 items-center rounded-card border border-input px-3 text-16 text-slate">
                +57
              </span>
              <Input
                id="clientPhone"
                value={phone}
                inputMode="numeric"
                maxLength={10}
                autoComplete="off"
                onChange={(event) =>
                  setPhone(event.target.value.replace(/\D/g, ""))
                }
                aria-invalid={error?.field === "phone" ? true : undefined}
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-14 text-danger">
              {error.message}
            </p>
          )}
          <Button
            type="submit"
            disabled={pending || fullName.trim().length === 0}
            className="w-full"
          >
            {pending && <LoaderCircle className="animate-spin" />}
            {pending ? "Creando…" : "Crear"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ClientPickerProps {
  clients: AgendaClient[];
  canCreate: boolean;
  onPick: (client: AgendaClient) => void;
  onSkip: () => void;
  /** El título del paso; null si ya lo dice la barra (editor de factura). */
  title?: string | null;
  /** El botón de seguir sin ficha ("Continuar sin agregar cliente" en la factura). */
  skipLabel?: string;
}

// Paso del cliente del editor (T-3.4.1, US-017): buscar por nombre o celular, crear uno rápido o
// seguir sin cliente (la hoja pide el nombre al final). El editor de factura lo reusa (T-8.3.1).
export function ClientPicker({
  clients,
  canCreate,
  onPick,
  onSkip,
  title = "Elige el cliente",
  skipLabel = "Seguir sin cliente",
}: ClientPickerProps) {
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const found = clients.filter((client) => matches(client, query));

  return (
    <div className="flex flex-col gap-4 px-5 pb-10 pt-5">
      {title && <h2 className="text-20 font-bold text-primary">{title}</h2>}
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate"
        />
        <Input
          type="search"
          aria-label="Buscar cliente"
          placeholder="Busca por nombre o celular"
          value={query}
          // Lo que se escribe antes de que React tome la página se borra al tomarla.
          disabled={!hydrated}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-11"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {canCreate && (
          <Button
            type="button"
            variant="outline"
            disabled={!hydrated}
            onClick={() => setCreating(true)}
          >
            <UserPlus />
            Crear cliente
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={!hydrated}
          onClick={onSkip}
        >
          <UserRoundX />
          {skipLabel}
        </Button>
      </div>

      {found.length === 0 ? (
        <EmptyState
          message={
            clients.length === 0
              ? "Todavía no tienes clientes. Crea uno o sigue sin cliente."
              : "No encontramos clientes con esa búsqueda."
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {found.slice(0, MAX_SHOWN).map((client) => (
            <li key={client.id}>
              <button
                type="button"
                disabled={!hydrated}
                onClick={() => onPick(client)}
                className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
              >
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-16 font-bold text-primary"
                >
                  {client.fullName.charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-16 font-bold text-ink">
                    {client.fullName}
                  </span>
                  <span className="text-14 text-slate">
                    {client.phone ? formatPhone(client.phone) : "Sin celular"}
                    {client.hasAccount ? " · Usa la app" : ""}
                  </span>
                </span>
                {client.isBlocked && (
                  <span className="rounded-full bg-soft px-2 py-0.5 text-12 text-slate">
                    Bloqueado
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {found.length > MAX_SHOWN && (
        <p className="text-center text-14 text-slate">
          Hay {found.length - MAX_SHOWN} más: escribe para encontrarlos.
        </p>
      )}

      <QuickClientDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(client) => {
          setCreating(false);
          onPick(client);
        }}
      />
    </div>
  );
}
