import { i18n } from "../i18n";
import { parseLocalIsoDate } from "./date";

function formatDecimal(value: string, fractionDigits = 1) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return "0";
  }

  return new Intl.NumberFormat(i18n.resolvedLanguage, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(parsed);
}

export function formatHours(value: string) {
  return `${formatDecimal(value)}${i18n.t("common:time.hoursShort")}`;
}

export function formatCurrency(value: string, currency: string) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return `${currency} 0`;
  }

  return new Intl.NumberFormat(i18n.resolvedLanguage, {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(parsed);
}

export function formatDisplayDate(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(parseLocalIsoDate(value));
}

export function formatMinutesAsDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return `0${i18n.t("common:time.hoursShort")} 00${i18n.t("common:time.minutesShort")}`;
  }

  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return `${hours}${i18n.t("common:time.hoursShort")} ${String(minutes).padStart(2, "0")}${i18n.t("common:time.minutesShort")}`;
}

export function formatTimeRange(startTime?: string | null, endTime?: string | null) {
  if (!startTime || !endTime) {
    return null;
  }

  return `${startTime} - ${endTime}`;
}
