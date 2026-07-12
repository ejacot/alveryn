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

export function formatMinutesAsDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0h 00m";
  }

  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function formatTimeRange(startTime?: string | null, endTime?: string | null) {
  if (!startTime || !endTime) {
    return null;
  }

  return `${startTime} -> ${endTime}`;
}
