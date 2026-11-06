"use client";

import { LoaderCircle } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { createCategory } from "../services/actions";
import type { Category } from "../types/catalog";

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (category: Category) => void;
}

// Ventana "Nueva categoría" del editor de servicio (US-011, captura 64).
export function CategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: CategoryDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useActionTransition();

  const close = (next: boolean) => {
    if (!next) {
      setName("");
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    // La ventana va dentro del formulario del servicio: que no lo envíe también.
    event.preventDefault();
    event.stopPropagation();
    startTransition(async () => {
      const result = await createCategory({ name });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onCreated(result.data);
      close(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="gap-6 px-6 pb-8 pt-12">
        <div className="flex flex-col gap-1 text-center">
          <DialogTitle className="text-18 font-bold text-primary">
            Nueva categoría
          </DialogTitle>
          <DialogDescription className="text-14 text-slate">
            Agrupa tus servicios: Cortes, Barba, Uñas…
          </DialogDescription>
        </div>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="categoryName"
              className="text-14 font-bold text-ink"
            >
              Nombre de la categoría <span aria-hidden="true">*</span>
            </label>
            <Input
              id="categoryName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Escribe un nombre para tu categoría"
              maxLength={40}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "categoryName-error" : undefined}
            />
            {error && (
              <p
                id="categoryName-error"
                role="alert"
                className="text-14 text-danger"
              >
                {error}
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={pending || name.trim().length === 0}
            className="w-full"
          >
            {pending && <LoaderCircle className="animate-spin" />}
            {pending ? "Creando…" : "Crear categoría"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
