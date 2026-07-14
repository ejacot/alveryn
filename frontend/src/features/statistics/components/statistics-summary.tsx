import { useTranslation } from "react-i18next";
import type { StatisticsOverview } from "../types/statistics";

type Props = {
  overview: StatisticsOverview;
};

function numberValue(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function formatCurrency(value: string, currency: string | null, locale: string) {
  if (!currency || currency === "MIXED") {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(numberValue(value));
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(numberValue(value));
}

function formatHours(minutes: string, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(numberValue(minutes) / 60);
}

export function StatisticsPrimarySummary({ overview }: Props) {
  const { i18n, t } = useTranslation("common");
  const comparison = numberValue(overview.comparisonPercentage);
  const sign = comparison > 0 ? "+" : "";

  return (
    <section aria-labelledby="statistics-primary-summary" className="space-y-2 py-4">
      <p id="statistics-primary-summary" className="hairline-text">
        {t("statistics.primarySummary")}
      </p>
      <p className="text-[4.5rem] font-semibold leading-none tracking-[-0.09em] text-white">
        {formatCurrency(overview.grossAmount, overview.currency, i18n.language)}
      </p>
      <p className="text-sm font-medium text-white/52">
        <span className="text-white/82">
          {sign}
          {comparison.toFixed(0)}%
        </span>{" "}
        {t("statistics.comparedToPrevious")}
      </p>
    </section>
  );
}

export function StatisticsSummaryCards({ overview }: Props) {
  const { i18n, t } = useTranslation("common");
  const cards = [
    { label: t("statistics.cards.hours"), value: formatHours(overview.workedMinutes, i18n.language) },
    { label: t("statistics.cards.workedDays"), value: overview.workedDays.toString() },
    { label: t("statistics.cards.entries"), value: overview.entries.toString() },
    { label: t("statistics.cards.averagePerDay"), value: formatHours(overview.averageMinutesPerDay, i18n.language) }
  ];

  return (
    <section aria-label={t("statistics.cards.label")} className="grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <article key={card.label} className="surface-muted p-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-white/38">{card.label}</h2>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-white">{card.value}</p>
        </article>
      ))}
    </section>
  );
}
