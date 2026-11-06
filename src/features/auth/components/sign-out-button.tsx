"use client";

import { LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { signOut } from "../services/actions";

type SignOutButtonProps = Pick<ButtonProps, "variant" | "className"> & {
  /** "Cerrar sesión" o, en la franja del inicio de la demo, "Cambiar". */
  label?: string;
};

function SubmitButton({ variant, className, label }: SignOutButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending}
      className={className}
    >
      <LogOut />
      {pending ? "Cerrando sesión…" : label}
    </Button>
  );
}

export function SignOutButton({
  variant = "outline",
  className,
  label = "Cerrar sesión",
}: SignOutButtonProps) {
  return (
    <form action={signOut}>
      <SubmitButton variant={variant} className={className} label={label} />
    </form>
  );
}
