// Celulares de Colombia: 10 dígitos que empiezan por 3, con el indicativo +57.
// En la app se guardan como "+573001234567" (profiles.phone); Supabase Auth los guarda
// sin el "+" ("573001234567").

const COUNTRY_CODE = "57";
const MOBILE = /^3\d{9}$/;

/** Deja el celular como "+573001234567", o null si no es un celular colombiano. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith(COUNTRY_CODE))
    digits = digits.slice(2);
  return MOBILE.test(digits) ? `+${COUNTRY_CODE}${digits}` : null;
}

export function isColombianMobile(input: string): boolean {
  return normalizePhone(input) !== null;
}

/** "+573001234567" → "+57 300 123 4567". Si no es válido, lo devuelve como llegó. */
export function formatPhone(input: string): string {
  const phone = normalizePhone(input);
  if (!phone) return input;
  const local = phone.slice(3);
  return `+57 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/** Los 10 dígitos locales: "+573001234567" → "3001234567". */
export function localDigits(input: string): string | null {
  const phone = normalizePhone(input);
  return phone ? phone.slice(3) : null;
}

/** Como lo guarda Supabase Auth: "+573001234567" → "573001234567". */
export function toAuthPhone(input: string): string | null {
  const phone = normalizePhone(input);
  return phone ? phone.slice(1) : null;
}
