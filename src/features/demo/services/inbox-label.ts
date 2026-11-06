import type { CurrentPerson } from "@/features/auth/services/queries";

/** "Mateo Gómez · Cliente", para el subtítulo de la bandeja. */
export function personInboxLabel(person: CurrentPerson): string {
  return `${person.fullName ?? "Persona sin nombre"} · ${person.roleLabel}`;
}
