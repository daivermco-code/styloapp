"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { formatLongDate } from "@/shared/lib/dates";
import {
  setClientPreference,
  updateClientProfile,
} from "../services/profile-actions";
import type { ClientProfile, Gender, PreferenceKey } from "../types/profile";

const GENDER_LABELS: Record<Gender, string> = {
  male: "Hombre",
  female: "Mujer",
  other: "Otro",
};

/** Los cuatro interruptores de US-032 con su explicación. */
const PREFERENCES: { key: PreferenceKey; label: string; hint: string }[] = [
  {
    key: "share_phone_on_booking",
    label: "Compartir mi celular al reservar",
    hint: "El negocio lo ve en tus citas.",
  },
  {
    key: "share_phone_with_followed",
    label: "Compartirlo con los negocios que sigo",
    hint: "Los negocios que sigues podrán escribirte con novedades.",
  },
  {
    key: "whatsapp_booking_messages",
    label: "Mensajes de mis citas por WhatsApp",
    hint: "Confirmaciones, cambios y recordatorios en la bandeja.",
  },
  {
    key: "whatsapp_promotions",
    label: "Promociones por WhatsApp",
    hint: "Ofertas de los negocios donde reservas.",
  },
];

/** "Hombre · 14 de marzo de 1995", o lo que haya. */
function personLine(profile: ClientProfile): string {
  const birth = profile.birthDate
    ? formatLongDate(`${profile.birthDate}T12:00:00-05:00`).replace(
        /^[^,]+, /,
        "",
      )
    : null;
  return [profile.gender && GENDER_LABELS[profile.gender], birth]
    .filter(Boolean)
    .join(" · ");
}

interface EditProfileDialogProps {
  profile: ClientProfile;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Editar perfil: nombre (2 a 80 caracteres), género y fecha de nacimiento opcionales.
function EditProfileDialog({
  profile,
  today,
  open,
  onOpenChange,
}: EditProfileDialogProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.fullName);
  const [gender, setGender] = useState<Gender | undefined>(
    profile.gender ?? undefined,
  );
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useActionTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateClientProfile({
        fullName,
        gender,
        birthDate: birthDate || undefined,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      toast.success("Perfil guardado");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-32px)] rounded-card">
        <DialogTitle className="text-20 font-bold text-secondary">
          Editar perfil
        </DialogTitle>
        <DialogDescription className="sr-only">
          Tu nombre, tu género y tu fecha de nacimiento.
        </DialogDescription>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="fullName" className="text-14 font-bold text-ink">
              Nombre y apellido
            </label>
            <Input
              id="fullName"
              autoComplete="name"
              maxLength={80}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "fullName-error" : undefined}
            />
            {error && (
              <p
                id="fullName-error"
                role="alert"
                className="text-14 text-danger"
              >
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="gender" className="text-14 font-bold text-ink">
              Género <span className="font-medium text-slate">(opcional)</span>
            </label>
            <Select
              value={gender}
              onValueChange={(value) => setGender(value as Gender)}
            >
              <SelectTrigger id="gender">
                <SelectValue placeholder="Elige uno" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(GENDER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="birthDate" className="text-14 font-bold text-ink">
              Fecha de nacimiento{" "}
              <span className="font-medium text-slate">(opcional)</span>
            </label>
            <Input
              id="birthDate"
              type="date"
              min="1900-01-01"
              max={today}
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={pending} className="mt-2 w-full">
            {pending && <LoaderCircle className="animate-spin" />}
            Guardar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PreferenceRow({
  item,
  initial,
}: {
  item: (typeof PREFERENCES)[number];
  initial: boolean;
}) {
  const hydrated = useHydrated();
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useActionTransition();
  const id = `pref-${item.key}`;

  const change = (value: boolean) => {
    setOn(value);
    startTransition(async () => {
      const result = await setClientPreference({ key: item.key, value });
      if (result.ok) return;
      setOn(!value);
      toast.error(result.error.message);
    });
  };

  return (
    <li className="flex items-center gap-4 border-b border-line py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <label htmlFor={id} className="text-16 text-ink">
          {item.label}
        </label>
        <p id={`${id}-hint`} className="text-14 text-slate">
          {item.hint}
        </p>
      </div>
      <Switch
        id={id}
        checked={on}
        disabled={!hydrated || pending}
        onCheckedChange={change}
        aria-describedby={`${id}-hint`}
      />
    </li>
  );
}

interface ClientProfileViewProps {
  profile: ClientProfile;
  today: string;
}

// Perfil del cliente (US-032): nombre, género y fecha con Editar perfil, los cuatro interruptores
// que se guardan al tocarlos y Cerrar sesión.
export function ClientProfileView({ profile, today }: ClientProfileViewProps) {
  const hydrated = useHydrated();
  const [editing, setEditing] = useState(false);
  const line = personLine(profile);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center gap-4">
        <span
          aria-hidden
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-25 font-bold text-surface"
        >
          {(profile.fullName || "?").charAt(0).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          <h2 className="text-22 font-bold text-primary [overflow-wrap:anywhere]">
            {profile.fullName}
          </h2>
          {line && <p className="text-14 text-slate">{line}</p>}
          <Button
            type="button"
            variant="ghost"
            disabled={!hydrated}
            onClick={() => setEditing(true)}
            className="-ml-4 min-h-11"
          >
            Editar perfil
          </Button>
        </div>
      </section>

      <section aria-labelledby="lo-que-compartes" className="flex flex-col">
        <h3
          id="lo-que-compartes"
          className="border-b border-line pb-2 text-16 font-bold text-secondary"
        >
          Lo que compartes y los mensajes
        </h3>
        <ul>
          {PREFERENCES.map((item) => (
            <PreferenceRow
              key={item.key}
              item={item}
              initial={profile.preferences[item.key]}
            />
          ))}
        </ul>
      </section>

      <SignOutButton variant="outline" className="self-center" />

      {editing && (
        <EditProfileDialog
          profile={profile}
          today={today}
          open={editing}
          onOpenChange={setEditing}
        />
      )}
    </div>
  );
}
