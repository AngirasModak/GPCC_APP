export function formatCurrency(
  value: number | null | undefined
): string {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactCurrency(
  value: number | null | undefined
): string {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatNumber(
  value: number | null | undefined
): string {
  return new Intl.NumberFormat("en-IN").format(
    Number(value ?? 0)
  );
}

export function formatDate(
  value: string | Date | null | undefined
): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}