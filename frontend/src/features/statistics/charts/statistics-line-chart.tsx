import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "../../../components/ui/card";
import { cn } from "../../../utils/cn";
import type {
  StatisticsAdvancedComparison,
  StatisticsComparisonSeriesPoint,
  StatisticsPeriod,
  StatisticsTimeSeriesPoint
} from "../types/statistics";

type Props = {
  points: StatisticsTimeSeriesPoint[];
  comparison?: StatisticsAdvancedComparison;
  metric: string;
  granularity: string;
  onPointSelect?: (point: StatisticsTimeSeriesPoint | null) => void;
  comparisonPeriod?: StatisticsPeriod;
  comparisonPeriodB?: { from: string; to: string } | null;
  onComparisonPeriodBChange?: (period: { from: string; to: string }) => void;
};

const chart = { width: 640, height: 400, left: 44, right: 14, top: 48, bottom: 124 };

function formatValue(value: number, metric: string, currency: string | null, locale: string, compact = false) {
  if (currency) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 2
    }).format(value);
  }
  if (metric === "WORKED_MINUTES" || metric === "AVERAGE_MINUTES_PER_WORKED_DAY") {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value / 60)} h`;
  }
  if (metric === "WORKED_HOURS") {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} h`;
  }
  return new Intl.NumberFormat(locale, {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function smoothPath(coordinates: Array<{ x: number; y: number }>) {
  if (coordinates.length === 0) return "";
  if (coordinates.length === 1) return `M ${coordinates[0].x} ${coordinates[0].y}`;
  return coordinates.slice(1).reduce((path, point, index) => {
    const previous = coordinates[index];
    const middle = (previous.x + point.x) / 2;
    return `${path} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${coordinates[0].x} ${coordinates[0].y}`);
}

function labelIndexes(length: number) {
  if (length <= 8) return Array.from({ length }, (_, index) => index);
  const count = length <= 16 ? 6 : 5;
  return Array.from({ length: count }, (_, index) =>
    Math.round((index / (count - 1)) * (length - 1))
  );
}

function groupedComparison(data: StatisticsAdvancedComparison) {
  const groups = new Map<string, StatisticsComparisonSeriesPoint[]>();
  for (const point of data.series.points) {
    const key = point.currency ?? "value";
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }
  return Array.from(groups.entries());
}

function currentPointLabel(date: string, granularity: string, locale: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (granularity === "MONTHLY") {
    return new Intl.DateTimeFormat(locale, { month: "short" }).format(parsed);
  }
  if (granularity === "WEEKLY") {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(parsed);
  }
  return new Intl.DateTimeFormat(locale, { day: "numeric" }).format(parsed);
}

function comparisonAxisLabel(point: StatisticsComparisonSeriesPoint, granularity: string, locale: string) {
  if (!point.periodABucketStart || !point.periodABucketEnd) return point.label;
  const from = new Date(`${point.periodABucketStart}T12:00:00`);
  const to = new Date(`${point.periodABucketEnd}T12:00:00`);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (granularity === "MONTHLY" || days >= 27) {
    return new Intl.DateTimeFormat(locale, { month: "short" }).format(from);
  }
  return point.label;
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function resolvedComparisonPeriod(
  from: string,
  to: string,
  period: StatisticsPeriod | undefined
): StatisticsPeriod {
  if (period && period !== "custom") return period;
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const fullYear = start.getMonth() === 0
    && start.getDate() === 1
    && end.getMonth() === 11
    && end.getDate() === 31
    && start.getFullYear() === end.getFullYear();
  if (fullYear) return "year";
  const lastDayOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const fullMonth = start.getDate() === 1
    && end.getFullYear() === start.getFullYear()
    && end.getMonth() === start.getMonth()
    && end.getDate() === lastDayOfMonth;
  if (fullMonth) return "month";
  if (days === 7) return "week";
  return "custom";
}

function comparisonRangeName(from: string, to: string, period: StatisticsPeriod | undefined, locale: string) {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const resolvedPeriod = resolvedComparisonPeriod(from, to, period);
  if (resolvedPeriod === "year") return String(start.getFullYear());
  if (resolvedPeriod === "month") {
    return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(start);
  }
  const format = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  return `${format.format(start)} – ${format.format(end)}`;
}

function comparisonReferenceOptions(
  periodA: { from: string; to: string },
  period: StatisticsPeriod | undefined,
  locale: string
) {
  const anchor = new Date(`${periodA.from}T12:00:00`);
  const periodEnd = new Date(`${periodA.to}T12:00:00`);
  const resolvedPeriod = resolvedComparisonPeriod(periodA.from, periodA.to, period);
  const duration = Math.round((periodEnd.getTime() - anchor.getTime()) / 86_400_000) + 1;
  const count = resolvedPeriod === "year" ? 10 : resolvedPeriod === "month" ? 48 : 104;
  return Array.from({ length: count }, (_, index) => {
    const offset = index + 1;
    let from: Date;
    let to: Date;
    if (resolvedPeriod === "year") {
      from = new Date(anchor.getFullYear() - offset, 0, 1, 12);
      to = new Date(anchor.getFullYear() - offset, 11, 31, 12);
    } else if (resolvedPeriod === "month") {
      from = new Date(anchor.getFullYear(), anchor.getMonth() - offset, 1, 12);
      to = new Date(from.getFullYear(), from.getMonth() + 1, 0, 12);
    } else if (resolvedPeriod === "week") {
      from = new Date(anchor);
      from.setDate(from.getDate() - offset * 7);
      to = new Date(from);
      to.setDate(to.getDate() + 6);
    } else {
      to = new Date(anchor);
      to.setDate(to.getDate() - 1 - index * duration);
      from = new Date(to);
      from.setDate(from.getDate() - duration + 1);
    }
    const range = { from: formatIsoDate(from), to: formatIsoDate(to) };
    return {
      ...range,
      value: `${range.from}|${range.to}`,
      label: comparisonRangeName(range.from, range.to, resolvedPeriod, locale)
    };
  });
}

function groupedCurrent(points: StatisticsTimeSeriesPoint[], granularity: string, locale: string) {
  const groups = new Map<string, StatisticsComparisonSeriesPoint[]>();
  for (const point of points) {
    const key = point.currency ?? "value";
    groups.set(key, [...(groups.get(key) ?? []), {
      label: currentPointLabel(point.bucketStart, granularity, locale),
      periodABucketStart: point.bucketStart,
      periodABucketEnd: point.bucketEnd,
      periodBBucketStart: null,
      periodBBucketEnd: null,
      periodAValue: point.value,
      periodBValue: "0",
      currency: point.currency
    }]);
  }
  return Array.from(groups.entries());
}

function compactSeries(points: StatisticsComparisonSeriesPoint[], metric: string) {
  if (points.length <= 31) return points;
  const groupSize = 7;
  const compacted: StatisticsComparisonSeriesPoint[] = [];
  for (let start = 0; start < points.length; start += groupSize) {
    const group = points.slice(start, start + groupSize);
    const averageMetric = metric === "AVERAGE_MINUTES_PER_WORKED_DAY";
    const sum = (selector: "periodAValue" | "periodBValue") => {
      const value = group.reduce((total, point) => total + Number(point[selector]), 0);
      return String(averageMetric ? value / group.length : value);
    };
    compacted.push({
      label: `${start + 1}–${start + group.length}`,
      periodABucketStart: group[0].periodABucketStart,
      periodABucketEnd: group.at(-1)?.periodABucketEnd ?? null,
      periodBBucketStart: group[0].periodBBucketStart,
      periodBBucketEnd: group.at(-1)?.periodBBucketEnd ?? null,
      periodAValue: sum("periodAValue"),
      periodBValue: sum("periodBValue"),
      currency: group[0].currency
    });
  }
  return compacted;
}

function periodLabel(from: string, to: string, locale: string) {
  const format = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  return `${format.format(new Date(`${from}T12:00:00`))} – ${format.format(new Date(`${to}T12:00:00`))}`;
}

function trendRangeLabel(points: StatisticsTimeSeriesPoint[], granularity: string, locale: string) {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return "";
  const from = new Date(`${first.bucketStart}T12:00:00`);
  const to = new Date(`${last.bucketEnd}T12:00:00`);

  if (granularity === "MONTHLY" && from.getFullYear() === to.getFullYear()) {
    const month = new Intl.DateTimeFormat(locale, { month: "short" });
    return from.getMonth() === to.getMonth()
      ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(from)
      : `${month.format(from)} – ${month.format(to)} ${to.getFullYear()}`;
  }

  const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  return `${formatter.format(from)} – ${formatter.format(to)} ${to.getFullYear()}`;
}

export function StatisticsLineChart({
  points,
  comparison,
  metric,
  granularity,
  onPointSelect,
  comparisonPeriod,
  comparisonPeriodB,
  onComparisonPeriodBChange
}: Props) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [mode, setMode] = useState<"trend" | "compare">("trend");
  const [selectedComparisonPoint, setSelectedComparisonPoint] =
    useState<StatisticsComparisonSeriesPoint | null>(null);
  const canCompare = Boolean(comparison && comparison.series.points.length > 0);
  const comparisonOptions = comparison
    ? comparisonReferenceOptions(comparison.periodA, comparisonPeriod, locale)
    : [];
  const selectedComparisonPeriodB = comparisonPeriodB ?? (comparison
    ? { from: comparison.periodB.from, to: comparison.periodB.to }
    : null);
  const comparisonPickerPeriod = comparison
    ? resolvedComparisonPeriod(comparison.periodA.from, comparison.periodA.to, comparisonPeriod)
    : "custom";
  const comparisonReferenceDate = selectedComparisonPeriodB
    ? new Date(`${selectedComparisonPeriodB.from}T12:00:00`)
    : null;
  const comparisonYearOptions = comparison
    ? Array.from({ length: 10 }, (_, index) => new Date(`${comparison.periodA.from}T12:00:00`).getFullYear() - index)
    : [];

  const changeComparisonMonthOrYear = (month: number | null, year: number) => {
    if (!onComparisonPeriodBChange) return;
    if (comparisonPickerPeriod === "year") {
      onComparisonPeriodBChange({ from: `${year}-01-01`, to: `${year}-12-31` });
    } else {
      const selectedMonth = month ?? 0;
      const from = new Date(year, selectedMonth, 1, 12);
      const to = new Date(year, selectedMonth + 1, 0, 12);
      onComparisonPeriodBChange({ from: formatIsoDate(from), to: formatIsoDate(to) });
    }
    setSelectedComparisonPoint(null);
  };

  if (points.length === 0 && !canCompare) {
    return <SinglePeriodFallback points={points} metric={metric} granularity={granularity} />;
  }

  return (
    <section className="space-y-4" aria-labelledby="statistics-trend-title">
      <div className="flex items-center justify-between gap-3">
        <p className="hairline-text">{t("statistics.trend.eyebrow")}</p>
        <div className="flex rounded-full border border-black/10 bg-black/[0.035] p-1 dark:border-white/10 dark:bg-white/[0.04]">
          {(["trend", "compare"] as const).map((item) => (
            <button
              key={item}
              type="button"
              disabled={item === "compare" && !canCompare}
              onClick={() => {
                setMode(item);
                if (item === "trend") setSelectedComparisonPoint(null);
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                mode === item
                  ? "bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-black"
                  : "text-neutral-500 dark:text-white/45",
                item === "compare" && !canCompare && "cursor-not-allowed opacity-40"
              )}
            >
              {t(`statistics.trend.modes.${item}` as never)}
            </button>
          ))}
        </div>
      </div>
      {mode === "trend" ? (
        <CurrentTrendCard
          points={points}
          metric={metric}
          granularity={granularity}
          locale={locale}
          onPointSelect={onPointSelect}
          t={t}
        />
      ) : comparison ? (
        <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 px-5 py-5 dark:border-white/10 sm:px-6">
          <div>
            <h2 id="statistics-trend-title" className="text-2xl font-semibold tracking-[-0.02em] text-neutral-950 dark:text-white">
              {comparisonRangeName(comparison.periodA.from, comparison.periodA.to, comparisonPeriod, locale)} {" "}
              <span className="text-neutral-400 dark:text-white/35">vs.</span> {" "}
              {comparisonRangeName(comparison.periodB.from, comparison.periodB.to, comparisonPeriod, locale)}
            </h2>
            <p className="mt-1.5 text-base text-neutral-500 dark:text-white/45">
              {t(`statistics.metrics.${metric}` as never, metric)}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="flex items-center gap-2 text-neutral-900 dark:text-white">
              <i className="h-0.5 w-5 rounded-full bg-emerald-500" />
              {t("statistics.trend.current")}
            </span>
            <span className="flex items-center gap-2 text-neutral-500 dark:text-white/45">
              <i className="h-0.5 w-5 rounded-full bg-neutral-400" />
              {t("statistics.trend.previous")}
            </span>
          </div>
          {selectedComparisonPeriodB && comparisonReferenceDate && onComparisonPeriodBChange ? (
            comparisonPickerPeriod === "year" || comparisonPickerPeriod === "month" ? (
              <div className="w-full sm:max-w-xs">
                <p className="text-xs font-semibold text-neutral-500 dark:text-white/45">
                  {t("statistics.trend.compareWith")}
                </p>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <label className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-neutral-400 dark:text-white/35">
                    {t("statistics.trend.compareMonth")}
                    <select
                      aria-label={t("statistics.trend.compareMonth")}
                      disabled={comparisonPickerPeriod === "year"}
                      value={comparisonPickerPeriod === "year" ? "all" : String(comparisonReferenceDate.getMonth())}
                      onChange={(event) => changeComparisonMonthOrYear(Number(event.target.value), comparisonReferenceDate.getFullYear())}
                      className="mt-1 h-10 w-full rounded-xl border border-black/10 bg-black/[0.035] px-2 text-sm font-semibold capitalize text-neutral-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.045] dark:text-white"
                    >
                      {comparisonPickerPeriod === "year" ? (
                        <option value="all">{t("statistics.trend.allMonths")}</option>
                      ) : Array.from({ length: 12 }, (_, month) => (
                        <option key={month} value={month}>
                          {new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2026, month, 1))}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-neutral-400 dark:text-white/35">
                    {t("statistics.trend.compareYear")}
                    <select
                      aria-label={t("statistics.trend.compareYear")}
                      value={comparisonReferenceDate.getFullYear()}
                      onChange={(event) => changeComparisonMonthOrYear(
                        comparisonPickerPeriod === "month" ? comparisonReferenceDate.getMonth() : null,
                        Number(event.target.value)
                      )}
                      className="mt-1 h-10 w-full rounded-xl border border-black/10 bg-black/[0.035] px-2 text-sm font-semibold text-neutral-900 outline-none dark:border-white/10 dark:bg-white/[0.045] dark:text-white"
                    >
                      {comparisonYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            ) : (
              <label className="min-w-[9rem] text-xs font-semibold text-neutral-500 dark:text-white/45">
                {t("statistics.trend.compareWith")}
                <select
                  aria-label={t("statistics.trend.compareWith")}
                  value={`${selectedComparisonPeriodB.from}|${selectedComparisonPeriodB.to}`}
                  onChange={(event) => {
                    const [from, to] = event.target.value.split("|");
                    onComparisonPeriodBChange({ from, to });
                    setSelectedComparisonPoint(null);
                  }}
                  className="mt-1.5 h-10 w-full rounded-xl border border-black/10 bg-black/[0.035] px-3 text-sm font-semibold text-neutral-900 outline-none dark:border-white/10 dark:bg-white/[0.045] dark:text-white"
                >
                  {comparisonOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            )
          ) : null}
        </div>

        <div className="grid grid-cols-3 border-b border-black/10 dark:border-white/10">
          <PeriodSummary
            label={t("statistics.trend.current")}
            period={periodLabel(comparison.periodA.from, comparison.periodA.to, locale)}
            value={selectedComparisonPoint
              ? formatValue(Number(selectedComparisonPoint.periodAValue), metric, selectedComparisonPoint.currency, locale)
              : summaryValue(comparison, true, metric, locale)}
          />
          <PeriodSummary
            label={t("statistics.trend.previous")}
            period={periodLabel(comparison.periodB.from, comparison.periodB.to, locale)}
            value={selectedComparisonPoint
              ? formatValue(Number(selectedComparisonPoint.periodBValue), metric, selectedComparisonPoint.currency, locale)
              : summaryValue(comparison, false, metric, locale)}
            bordered
          />
          <DifferenceSummary
            comparison={comparison}
            selectedPoint={selectedComparisonPoint}
            metric={metric}
            locale={locale}
            t={t}
          />
        </div>

        <div className="space-y-7 px-2 py-6 sm:px-5">
          {groupedComparison(comparison).map(([key, series]) => (
            <ComparisonGraph
              key={key}
              points={compactSeries(series, metric)}
              metric={metric}
              currency={key === "value" ? null : key}
              locale={locale}
              onPointSelect={onPointSelect}
              onComparisonSelect={setSelectedComparisonPoint}
              granularity={comparison.series.granularity}
              t={t}
            />
          ))}
        </div>
        </Card>
      ) : null}
    </section>
  );
}

function CurrentTrendCard({ points, metric, granularity, locale, onPointSelect, t }: {
  points: StatisticsTimeSeriesPoint[];
  metric: string;
  granularity: string;
  locale: string;
  onPointSelect?: (point: StatisticsTimeSeriesPoint | null) => void;
  t: ReturnType<typeof useTranslation<"common">>["t"];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-black/10 px-5 py-5 dark:border-white/10 sm:px-6">
        <h2 id="statistics-trend-title" className="text-2xl font-semibold tracking-[-0.02em] text-neutral-950 dark:text-white">
          {metric === "GROSS"
            ? t("statistics.primarySummary")
            : t(`statistics.metrics.${metric}` as never, metric)}
        </h2>
        <p className="mt-1.5 text-base text-neutral-500 dark:text-white/45">
          {trendRangeLabel(points, granularity, locale)}
        </p>
      </div>
      <div className="space-y-7 px-2 py-6 sm:px-5">
        {groupedCurrent(points, granularity, locale).map(([key, series]) => {
          const total = series.reduce((sum, point) => sum + Number(point.periodAValue), 0);
          return (
            <div key={key}>
              <div className="mb-2 flex items-end justify-between px-3">
                <div>
                  <p className="text-3xl font-semibold tracking-[-0.025em] tabular-nums text-neutral-950 dark:text-white">
                    {formatValue(total, metric, key === "value" ? null : key, locale)}
                  </p>
                </div>
                <span className="flex items-center gap-2 text-sm font-medium text-neutral-500 dark:text-white/45">
                  <i className="h-0.5 w-5 rounded-full bg-emerald-500" />
                  {t("statistics.trend.current")}
                </span>
              </div>
              <ComparisonGraph
                points={series}
                metric={metric}
                currency={key === "value" ? null : key}
                locale={locale}
                onPointSelect={onPointSelect}
                showPrevious={false}
                t={t}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PeriodSummary({ label, period, value, bordered = false }: {
  label: string; period: string; value: string; bordered?: boolean;
}) {
  return (
    <div className={cn("min-w-0 px-3 py-4 sm:px-6", bordered && "border-l border-black/10 dark:border-white/10")}>
      <p className="truncate text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-white/40 sm:text-[0.65rem]">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold tabular-nums text-neutral-950 dark:text-white sm:text-xl">{value}</p>
      <p className="mt-1 hidden truncate text-[0.68rem] text-neutral-500 dark:text-white/40 sm:block">{period}</p>
    </div>
  );
}

function summaryValue(data: StatisticsAdvancedComparison, current: boolean, metric: string, locale: string) {
  const period = current ? data.periodA : data.periodB;
  if (metric === "GROSS") {
    return period.grossByCurrency.map((money) =>
      formatValue(Number(money.amount), metric, money.currency, locale)
    ).join(" · ") || "—";
  }
  if (metric === "WORKED_HOURS") return formatValue(Number(period.workedMinutes) / 60, metric, null, locale);
  if (metric === "WORKED_MINUTES") return formatValue(Number(period.workedMinutes), metric, null, locale);
  if (metric === "WORKED_DAYS") return formatValue(period.workedDays, metric, null, locale);
  if (metric === "ENTRIES") return formatValue(period.entries, metric, null, locale);
  return formatValue(Number(period.averageMinutesPerWorkedDay), metric, null, locale);
}

function DifferenceSummary({ comparison, selectedPoint, metric, locale, t }: {
  comparison: StatisticsAdvancedComparison;
  selectedPoint?: StatisticsComparisonSeriesPoint | null;
  metric: string;
  locale: string;
  t: ReturnType<typeof useTranslation<"common">>["t"];
}) {
  const aggregateDifference = comparison.differences[0];
  if (!aggregateDifference && !selectedPoint) return null;
  const current = selectedPoint ? Number(selectedPoint.periodAValue) : Number(aggregateDifference?.periodAValue ?? 0);
  const previous = selectedPoint ? Number(selectedPoint.periodBValue) : Number(aggregateDifference?.periodBValue ?? 0);
  const absolute = selectedPoint ? current - previous : Number(aggregateDifference?.absolute ?? 0);
  const percentage = selectedPoint
    ? previous === 0 ? null : (absolute / previous) * 100
    : aggregateDifference?.percentage == null ? null : Number(aggregateDifference.percentage);
  const differenceCurrency = selectedPoint?.currency ?? aggregateDifference?.currency ?? null;
  return (
    <div className="min-w-0 border-l border-black/10 px-3 py-4 dark:border-white/10 sm:px-6">
      <p className="truncate text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-white/40 sm:text-[0.65rem]">
        {t("statistics.trend.changeLabel")}
      </p>
      <p className={cn(
        "mt-2 flex items-center gap-1 truncate text-sm font-semibold tabular-nums sm:text-xl",
        absolute >= 0 ? "text-emerald-500" : "text-red-500"
      )}>
        {absolute >= 0 ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
        {formatValue(Math.abs(absolute), metric, differenceCurrency, locale)}
      </p>
      <p className="mt-1 text-[0.65rem] text-neutral-500 dark:text-white/40">
        {percentage == null ? t("statistics.trend.noComparison") : `${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}%`}
      </p>
    </div>
  );
}

export type StatisticsTrendGraphPoint = {
  date: string;
  label: string;
  value: number;
  currency?: string | null;
};

export function StatisticsTrendGraph({
  points,
  metric,
  currency = null,
  onPointSelect
}: {
  points: StatisticsTrendGraphPoint[];
  metric: string;
  currency?: string | null;
  onPointSelect?: (point: StatisticsTrendGraphPoint) => void;
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const sourceByDate = new Map(points.map((point) => [point.date, point]));
  const series: StatisticsComparisonSeriesPoint[] = points.map((point) => ({
    label: point.label,
    periodABucketStart: point.date,
    periodABucketEnd: point.date,
    periodBBucketStart: null,
    periodBBucketEnd: null,
    periodAValue: String(point.value),
    periodBValue: "0",
    currency: point.currency ?? currency
  }));

  return (
    <ComparisonGraph
      points={series}
      metric={metric}
      currency={currency}
      locale={locale}
      showPrevious={false}
      t={t}
      onPointSelect={(point) => {
        if (!point) return;
        const source = sourceByDate.get(point.bucketStart);
        if (source) onPointSelect?.(source);
      }}
    />
  );
}

function ComparisonGraph({ points, metric, currency, locale, granularity = "DAILY", onPointSelect, onComparisonSelect, showPrevious = true, t }: {
  points: StatisticsComparisonSeriesPoint[];
  metric: string;
  currency: string | null;
  locale: string;
  granularity?: string;
  onPointSelect?: (point: StatisticsTimeSeriesPoint | null) => void;
  onComparisonSelect?: (point: StatisticsComparisonSeriesPoint | null) => void;
  showPrevious?: boolean;
  t: ReturnType<typeof useTranslation<"common">>["t"];
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const chartRef = useRef<SVGSVGElement>(null);
  const gradientId = useId().replace(/:/g, "");
  const seriesKey = points
    .map((point) => `${point.periodABucketStart}:${point.periodABucketEnd}:${point.periodAValue}:${point.currency ?? ""}`)
    .join("|");

  useEffect(() => {
    setSelectedIndex(null);
  }, [seriesKey]);

  useEffect(() => {
    if (selectedIndex === null) return;
    const clearFromOutside = (event: MouseEvent) => {
      if (chartRef.current?.contains(event.target as Node)) return;
      setSelectedIndex(null);
      if (showPrevious) onComparisonSelect?.(null);
      else onPointSelect?.(null);
    };
    document.addEventListener("click", clearFromOutside);
    return () => document.removeEventListener("click", clearFromOutside);
  }, [onComparisonSelect, onPointSelect, selectedIndex, showPrevious]);

  const all = points.flatMap((point) =>
    showPrevious
      ? [Number(point.periodAValue), Number(point.periodBValue)]
      : [Number(point.periodAValue)]
  );
  const maximum = Math.max(...all, 1);
  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const position = (value: number, index: number) => ({
    x: chart.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth),
    y: chart.top + plotHeight - (value / maximum) * plotHeight
  });
  const current = points.map((point, index) => position(Number(point.periodAValue), index));
  const previous = points.map((point, index) => position(Number(point.periodBValue), index));
  const currentPath = smoothPath(current);
  const areaPath = current.length > 0
    ? `${currentPath} L ${current.at(-1)?.x ?? chart.left} ${chart.top + plotHeight} L ${current[0].x} ${chart.top + plotHeight} Z`
    : "";
  const visibleLabelIndexes = Array.from(new Set([
    ...labelIndexes(points.length),
    ...(selectedIndex === null ? [] : [selectedIndex])
  ])).sort((a, b) => a - b);
  const selectedTouchLeft = selectedIndex === null
    ? null
    : selectedIndex === 0
      ? chart.left
      : (current[selectedIndex - 1].x + current[selectedIndex].x) / 2;
  const selectedTouchRight = selectedIndex === null
    ? null
    : selectedIndex === points.length - 1
      ? chart.width - chart.right
      : (current[selectedIndex].x + current[selectedIndex + 1].x) / 2;
  const selectPoint = (point: StatisticsComparisonSeriesPoint, index: number) => {
    if (selectedIndex === index) {
      setSelectedIndex(null);
      if (showPrevious) onComparisonSelect?.(null);
      else onPointSelect?.(null);
      return;
    }
    setSelectedIndex(index);
    if (showPrevious) {
      onComparisonSelect?.(point);
    }
    if (!showPrevious && point.periodABucketStart && point.periodABucketEnd) {
      onPointSelect?.({
        bucketStart: point.periodABucketStart,
        bucketEnd: point.periodABucketEnd,
        value: point.periodAValue,
        metric: metric as StatisticsTimeSeriesPoint["metric"],
        currency: point.currency
      });
    }
  };
  return (
    <svg
      ref={chartRef}
      viewBox={`0 0 ${chart.width} ${chart.height}`}
      className="h-auto w-full select-none touch-pan-y"
      role="img"
      aria-label={t("statistics.trend.ariaLabel")}
      onClick={(event) => {
        if ((event.target as Element).closest("[data-chart-point-hitbox]")) return;
        setSelectedIndex(null);
        if (showPrevious) onComparisonSelect?.(null);
        else onPointSelect?.(null);
      }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
          <stop offset="75%" stopColor="#10b981" stopOpacity="0.035" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      {selectedTouchLeft !== null && selectedTouchRight !== null ? (
        <rect
          x={selectedTouchLeft}
          y={chart.top - 8}
          width={selectedTouchRight - selectedTouchLeft}
          height={plotHeight + 16}
          rx="12"
          className="pointer-events-none fill-emerald-500/[0.07]"
        />
      ) : null}
      {[0, 0.5, 1].map((ratio) => {
        const y = chart.top + plotHeight * ratio;
        return (
          <g key={ratio}>
            <line x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y}
              className="stroke-black/[0.07] dark:stroke-white/[0.07]" strokeDasharray="4 5" />
            <text x={chart.left - 8} y={y + 4} textAnchor="end"
              className="fill-neutral-400 text-[18px] font-medium dark:fill-white/35">
              {formatValue(maximum * (1 - ratio), metric, currency, locale, true)}
            </text>
          </g>
        );
      })}
      {current.map((coordinate, index) => (
        <line
          key={`interval-${points[index].label}-${index}`}
          x1={coordinate.x}
          x2={coordinate.x}
          y1={chart.top}
          y2={chart.top + plotHeight}
          className="pointer-events-none stroke-black/[0.07] dark:stroke-white/[0.09]"
          strokeDasharray="3 5"
        />
      ))}
      {showPrevious ? (
        <motion.path d={smoothPath(previous)} fill="none" className="stroke-neutral-400 dark:stroke-white/30"
          strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 6"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.65 }} />
      ) : null}
      <motion.path
        d={areaPath}
        fill={`url(#${gradientId})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="pointer-events-none"
      />
      <motion.path d={currentPath} fill="none" className="stroke-emerald-500"
        strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.75 }} />

      {selectedIndex !== null ? (
        <line
          x1={current[selectedIndex].x}
          x2={current[selectedIndex].x}
          y1={chart.top}
          y2={chart.top + plotHeight}
          className="pointer-events-none stroke-emerald-500/25"
          strokeDasharray="3 4"
        />
      ) : null}

      {points.map((point, index) => {
        const selected = selectedIndex === index;
        const valueLabel = formatValue(Number(point.periodAValue), metric, currency, locale, true);
        const previousValueLabel = formatValue(Number(point.periodBValue), metric, currency, locale, true);
        const labelWidth = Math.max(84, valueLabel.length * 13 + 28);
        const previousLabelWidth = Math.max(84, previousValueLabel.length * 13 + 28);
        const labelX = Math.min(
          Math.max(current[index].x, chart.left + labelWidth / 2),
          chart.width - chart.right - labelWidth / 2
        );
        const currentIsHigher = current[index].y <= previous[index].y;
        const labelY = showPrevious && !currentIsHigher
          ? current[index].y + 14
          : Math.max(current[index].y - 58, 4);
        const previousLabelX = Math.min(
          Math.max(previous[index].x, chart.left + previousLabelWidth / 2),
          chart.width - chart.right - previousLabelWidth / 2
        );
        const previousLabelY = currentIsHigher
          ? previous[index].y + 14
          : Math.max(previous[index].y - 58, 4);
        const touchLeft = index === 0
          ? chart.left
          : (current[index - 1].x + current[index].x) / 2;
        const touchRight = index === points.length - 1
          ? chart.width - chart.right
          : (current[index].x + current[index + 1].x) / 2;

        return (
        <g key={`${point.label}-${point.currency ?? "value"}-${index}`}>
          {showPrevious ? (
            <>
              {selected ? (
                <g className="pointer-events-none">
                  <circle
                    cx={previous[index].x}
                    cy={previous[index].y}
                    r="6"
                    className="fill-neutral-400 stroke-white dark:fill-neutral-500 dark:stroke-neutral-900"
                    strokeWidth="2.5"
                  />
                  <rect
                    x={previousLabelX - previousLabelWidth / 2}
                    y={previousLabelY}
                    width={previousLabelWidth}
                    height="44"
                    rx="22"
                    className="fill-neutral-500 stroke-white/20 dark:fill-neutral-700"
                  />
                  <text
                    x={previousLabelX}
                    y={previousLabelY + 29}
                    textAnchor="middle"
                    className="fill-white text-[22px] font-bold tabular-nums"
                  >
                    {previousValueLabel}
                  </text>
                </g>
              ) : null}
            </>
          ) : null}
          {selected ? (
            <g className="pointer-events-none">
              <circle
                cx={current[index].x}
                cy={current[index].y}
                r="6.5"
                className="fill-emerald-400 stroke-white dark:stroke-neutral-900"
                strokeWidth="2.5"
              />
              <rect
                x={labelX - labelWidth / 2}
                y={labelY}
                width={labelWidth}
                height="44"
                rx="22"
                className="fill-neutral-950 stroke-emerald-500/50 drop-shadow-sm dark:fill-white"
              />
              <text
                x={labelX}
                y={labelY + 29}
                textAnchor="middle"
                className="fill-white text-[22px] font-bold tabular-nums dark:fill-neutral-950"
              >
                {valueLabel}
              </text>
            </g>
          ) : null}
          <rect
            data-chart-point-hitbox
            x={touchLeft}
            y={chart.top}
            width={touchRight - touchLeft}
            height={plotHeight}
            fill="transparent"
            className="cursor-pointer outline-none"
            role="button"
            tabIndex={0}
            aria-label={`${point.label}: ${valueLabel}`}
            onClick={() => selectPoint(point, index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectPoint(point, index);
              }
            }}
          />
        </g>
        );
      })}
      {visibleLabelIndexes.map((index) => {
        const selected = selectedIndex === index;
        const selectedAxisLabel = selected;
        const x = current[index].x;
        const anchor = index === 0 ? "start" : index === points.length - 1 ? "end" : "middle";
        const axisLabel = comparisonAxisLabel(points[index], granularity, locale);
        const selectedLabelWidth = Math.max(56, axisLabel.length * 12 + 24);
        const selectedLabelX = Math.min(
          Math.max(x, chart.left + selectedLabelWidth / 2),
          chart.width - chart.right - selectedLabelWidth / 2
        );

        return selectedAxisLabel ? (
          <g key={`${points[index].label}-${index}`} className="pointer-events-none">
            <rect
              x={selectedLabelX - selectedLabelWidth / 2}
              y={chart.height - 39}
              width={selectedLabelWidth}
              height="33"
              rx="16.5"
              className="fill-emerald-500/15"
            />
            <text
              x={selectedLabelX}
              y={chart.height - 16}
              textAnchor="middle"
              className="fill-emerald-600 text-[21px] font-bold dark:fill-emerald-400"
            >
              {axisLabel}
            </text>
          </g>
        ) : (
          <text
            key={`${points[index].label}-${index}`}
            x={x}
            y={chart.height - 14}
            textAnchor={anchor}
            className="fill-neutral-500 text-[17px] font-medium dark:fill-white/45"
          >
            {axisLabel}
          </text>
        );
      })}
    </svg>
  );
}

function SinglePeriodFallback({ points, metric, granularity }: {
  points: StatisticsTimeSeriesPoint[]; metric: string; granularity: string;
}) {
  const { t } = useTranslation("common");
  return (
    <Card as="section" variant="section">
      <p className="hairline-text">{t("statistics.trend.eyebrow")}</p>
      <p className="mt-3 text-sm text-neutral-500 dark:text-white/45">
        {points.length > 0
          ? `${t(`statistics.metrics.${metric}` as never, metric)} · ${t(`statistics.granularity.${granularity}` as never, granularity)}`
          : t("statistics.empty.description")}
      </p>
    </Card>
  );
}
