import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { queryKeys } from "../../../api/query-keys";
import { formatCurrency, formatHours } from "../../../utils/format";
import { getStatisticsComparison } from "../api/statistics-api";
import { formatStatisticsDate } from "../filters/statistics-filter-state";
import type { StatisticsComparisonRequest, StatisticsFilters } from "../types/statistics";

type Props = {
  filters: StatisticsFilters;
};

type Preset = "month" | "year" | "sameMonthPreviousYear" | "ytd" | "custom";

const DAY_MS = 86_400_000;

function monthRange(offset = 0) {
  const now = new Date();
  return {
    from: formatStatisticsDate(new Date(now.getFullYear(), now.getMonth() + offset, 1)),
    to: formatStatisticsDate(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0))
  };
}

function yearRange(offset = 0) {
  const now = new Date();
  return {
    from: formatStatisticsDate(new Date(now.getFullYear() + offset, 0, 1)),
    to: formatStatisticsDate(new Date(now.getFullYear() + offset, 11, 31))
  };
}

function ytdRange(offset = 0) {
  const now = new Date();
  return {
    from: formatStatisticsDate(new Date(now.getFullYear() + offset, 0, 1)),
    to: formatStatisticsDate(new Date(now.getFullYear() + offset, now.getMonth(), now.getDate()))
  };
}

function previousEqualRange(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  const days = Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS) + 1;
  const previousTo = new Date(fromDate.getTime() - DAY_MS);
  return {
    from: formatStatisticsDate(new Date(previousTo.getTime() - DAY_MS * (days - 1))),
    to: formatStatisticsDate(previousTo)
  };
}

function requestForPreset(filters: StatisticsFilters, preset: Preset): StatisticsComparisonRequest {
  const periodA =
    preset === "year"
      ? yearRange(0)
      : preset === "sameMonthPreviousYear"
        ? monthRange(0)
        : preset === "ytd"
          ? ytdRange(0)
          : preset === "custom"
            ? { from: filters.from, to: filters.to }
            : monthRange(0);
  const periodB =
    preset === "year"
      ? yearRange(-1)
      : preset === "sameMonthPreviousYear"
        ? {
            from: formatStatisticsDate(new Date(new Date(`${periodA.from}T00:00:00`).getFullYear() - 1, new Date(`${periodA.from}T00:00:00`).getMonth(), 1)),
            to: formatStatisticsDate(new Date(new Date(`${periodA.to}T00:00:00`).getFullYear() - 1, new Date(`${periodA.to}T00:00:00`).getMonth() + 1, 0))
          }
        : preset === "ytd"
          ? ytdRange(-1)
          : previousEqualRange(periodA.from, periodA.to);
  return {
    periodA,
    periodB,
    metric: filters.metric,
    workTypeIds: filters.workTypeIds,
    calculationMethods: filters.calculationMethods
  };
}

function formatDifferenceValue(value: string, currency: string | null, metric: string) {
  if (currency) {
    return formatCurrency(value, currency);
  }
  if (metric === "WORKED_HOURS") {
    return formatHours(value);
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(Number(value));
}

export function StatisticsComparisonPanel({ filters }: Props) {
  const { t } = useTranslation("common");
  const [preset, setPreset] = useState<Preset>("month");
  const request = useMemo(() => requestForPreset(filters, preset), [filters, preset]);
  const comparison = useQuery({
    queryKey: queryKeys.statistics.comparison({
      ...request,
      workTypeIds: [...request.workTypeIds].sort(),
      calculationMethods: [...request.calculationMethods].sort()
    }),
    queryFn: () => getStatisticsComparison(request)
  });

  return (
    <section className="section-card space-y-4" aria-labelledby="statistics-comparison-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/35">{t("statistics.comparison.eyebrow")}</p>
          <h2 id="statistics-comparison-title" className="text-base font-semibold text-white">
            {t("statistics.comparison.title")}
          </h2>
        </div>
        <select
          value={preset}
          onChange={(event) => setPreset(event.target.value as Preset)}
          className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
          aria-label={t("statistics.comparison.preset")}
        >
          <option value="month">{t("statistics.comparison.presets.month")}</option>
          <option value="year">{t("statistics.comparison.presets.year")}</option>
          <option value="sameMonthPreviousYear">{t("statistics.comparison.presets.sameMonthPreviousYear")}</option>
          <option value="ytd">{t("statistics.comparison.presets.ytd")}</option>
          <option value="custom">{t("statistics.comparison.presets.custom")}</option>
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[24px] bg-white/[0.035] p-4">
          <p className="text-xs text-white/40">{t("statistics.comparison.periodA")}</p>
          <p className="mt-1 text-sm font-medium text-white">
            {request.periodA.from} – {request.periodA.to}
          </p>
        </div>
        <div className="rounded-[24px] bg-white/[0.035] p-4">
          <p className="text-xs text-white/40">{t("statistics.comparison.periodB")}</p>
          <p className="mt-1 text-sm font-medium text-white">
            {request.periodB.from} – {request.periodB.to}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {(comparison.data?.differences ?? []).map((difference) => (
          <div key={difference.currency ?? "value"} className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">{difference.currency ?? t(`statistics.metrics.${comparison.data?.metric}` as never)}</p>
              <p className="text-xs text-white/45">
                {difference.available
                  ? t("statistics.comparison.percentage", { value: difference.percentage })
                  : t("statistics.comparison.unavailable")}
              </p>
            </div>
            <p className="text-lg font-semibold text-white">
              {formatDifferenceValue(difference.absolute, difference.currency, comparison.data?.metric ?? filters.metric)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
