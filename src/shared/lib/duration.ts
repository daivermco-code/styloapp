/** Minutos como se leen en la app: 15 → "15 min", 60 → "1 h", 90 → "1 h 30 min", 1440 → "24 h". */
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
