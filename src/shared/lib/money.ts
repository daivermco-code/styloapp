/** Pesos colombianos sin decimales y con punto de miles: 25000 → "$ 25.000". */
export function formatCOP(value: number): string {
  const rounded = Math.round(Math.abs(value));
  const digits = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${value < 0 ? "-" : ""}$ ${digits}`;
}
