export function parseDecimalInput(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  if (typeof value !== "string") {
    return Number.NaN;
  }

  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return 0;
  }

  return Number(normalized);
}
