function formatDecimal(value: string, fractionDigits = 1) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return "0";
  }

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(parsed);
}

export function formatHours(value: string) {
  return `${formatDecimal(value)}h`;
}

export function formatCurrency(value: string, currency: string) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return `${currency} 0`;
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(parsed);
}
