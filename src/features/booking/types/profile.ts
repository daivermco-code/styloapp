/** Lo que el cliente comparte y los mensajes que recibe (US-032): columnas de `profiles`. */
export const PREFERENCE_KEYS = [
  "share_phone_on_booking",
  "share_phone_with_followed",
  "whatsapp_booking_messages",
  "whatsapp_promotions",
] as const;

export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];

export type Gender = "male" | "female" | "other";

/** El perfil del cliente para la pantalla Perfil (US-032). */
export interface ClientProfile {
  fullName: string;
  gender: Gender | null;
  /** "YYYY-MM-DD" o null. */
  birthDate: string | null;
  preferences: Record<PreferenceKey, boolean>;
}
