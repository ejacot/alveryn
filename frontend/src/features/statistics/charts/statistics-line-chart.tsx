import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "../../../components/ui/card";
import { cn } from "../../../utils/cn";
import type {
  StatisticsAdvancedComparison,
  StatisticsComparisonSeriesPoint,
  StatisticsTimeSeriesPoint
} from "../types/statistics";

type Props = {
  points: StatisticsTimeSeriesPoint[];
  comparison?: StatisticsAdvancedComparison;
  metric: string;
  granularity: string;
  onPointSelect?: (point: StatisticsTimeSeriesPoint) => void;
};

const chart = { width: 760, height: 280, left: 48, right: 18, top: 38, bottom: 42 };

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
  if (points.length <= 12) return points;
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

export function StatisticsLineChart({
  points,
  comparison,
  metric,
  granularity,
  onPointSelect
}: Props) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [mode, setMode] = useState<"trend" | "compare">("trend");
  const canCompare = Boolean(comparison && comparison.series.points.length > 0);

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
              onClick={() => setMode(item)}
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
            <h2 id="statistics-trend-title" className="text-xl font-semibold text-neutral-950 dark:text-white">
              {t("statistics.trend.comparisonTitle")}
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-white/45">
              {t(`statistics.metrics.${metric}` as never, metric)}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-2 text-neutral-900 dark:text-white">
              <i className="h-0.5 w-5 rounded-full bg-emerald-500" />
              {t("statistics.trend.current")}
            </span>
            <span className="flex items-center gap-2 text-neutral-500 dark:text-white/45">
              <i className="h-0.5 w-5 rounded-full bg-neutral-400" />
              {t("statistics.trend.previous")}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 border-b border-black/10 dark:border-white/10">
          <PeriodSummary
            label={t("statistics.trend.current")}
            period={periodLabel(comparison.periodA.from, comparison.periodA.to, locale)}
            value={summaryValue(comparison, true, metric, locale)}
          />
          <PeriodSummary
            label={t("statistics.trend.previous")}
            period={periodLabel(comparison.periodB.from, comparison.periodB.to, locale)}
            value={summaryValue(comparison, false, metric, locale)}
            bordered
          />
          <DifferenceSummary comparison={comparison} metric={metric} locale={locale} t={t} />
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
  onPointSelect?: (point: StatisticsTimeSeriesPoint) => void;
  t: ReturnType<typeof useTranslation<"common">>["t"];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-black/10 px-5 py-5 dark:border-white/10 sm:px-6">
        <h2 id="statistics-trend-title" className="text-xl font-semibold text-neutral-950 dark:text-white">
          {t("statistics.trend.periodTitle")}
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-white/45">
          {t(`statistics.metrics.${metric}` as never, metric)} ·{" "}
          {t(`statistics.granularity.${granularity}` as never, granularity)}
        </p>
      </div>
      <div className="space-y-7 px-2 py-6 sm:px-5">
        {groupedCurrent(points, granularity, locale).map(([key, series]) => {
          const compacted = compactSeries(series, metric);
          const total = compacted.reduce((sum, point) => sum + Number(point.periodAValue), 0);
          return (
            <div key={key}>
              <div className="mb-2 flex items-end justify-between px-3">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-neutral-500 dark:text-white/40">
                    {t("statistics.trend.periodTotal")}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                    {formatValue(total, metric, key === "value" ? null : key, locale)}
                  </p>
                </div>
                <span className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-white/45">
                  <i className="h-0.5 w-5 rounded-full bg-emerald-500" />
                  {t("statistics.trend.current")}
                </span>
              </div>
              <ComparisonGraph
                points={compacted}
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

function DifferenceSummary({ comparison, metric, locale, t }: {
  comparison: StatisticsAdvancedComparison;
  metric: string;
  locale: string;
  t: ReturnType<typeof useTranslation<"common">>["t"];
}) {
  const difference = comparison.differences[0];
  if (!difference) return null;
  const percentage = difference.percentage == null ? null : Number(difference.percentage);
  return (
    <div className="min-w-0 border-l border-black/10 px-3 py-4 dark:border-white/10 sm:px-6">
      <p className="truncate text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-white/40 sm:text-[0.65rem]">
        {t("statistics.trend.changeLabel")}
      </p>
      <p className={cn(
        "mt-2 flex items-center gap-1 truncate text-sm font-semibold tabular-nums sm:text-xl",
        Number(difference.absolute) >= 0 ? "text-emerald-500" : "text-red-500"
      )}>
        {Number(difference.absolute) >= 0 ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
        {formatValue(Math.abs(Number(difference.absolute)), metric, difference.currency, locale)}
      </p>
      <p className="mt-1 text-[0.65rem] text-neutral-500 dark:text-white/40">
        {percentage == null ? t("statistics.trend.noComparison") : `${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}%`}
      </p>
    </div>
  );
}

function ComparisonGraph({ points, metric, currency, locale, onPointSelect, showPrevious = true, t }: {
  points: StatisticsComparisonSeriesPoint[];
  metric: string;
  currency: string | null;
  locale: string;
  onPointSelect?: (point: StatisticsTimeSeriesPoint) => void;
  showPrevious?: boolean;
  t: ReturnType<typeof useTranslation<"common">>["t"];
}) {
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

  return (
    <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-[14rem] w-full sm:h-[18rem]" role="img"
      aria-label={t("statistics.trend.ariaLabel")} preserveAspectRatio="none">
      {[0, 0.5, 1].map((ratio) => {
        const y = chart.top + plotHeight * ratio;
        return (
          <g key={ratio}>
            <line x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y}
              className="stroke-black/[0.07] dark:stroke-white/[0.07]" strokeDasharray="4 5" />
            <text x={chart.left - 8} y={y + 4} textAnchor="end"
              className="fill-neutral-400 text-[10px] dark:fill-white/30">
              {formatValue(maximum * (1 - ratio), metric, currency, locale, true)}
            </text>
          </g>
        );
      })}
      {showPrevious ? (
        <motion.path d={smoothPath(previous)} fill="none" className="stroke-neutral-400 dark:stroke-white/30"
          strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 6"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.65 }} />
      ) : null}
      <motion.path d={smoothPath(current)} fill="none" className="stroke-emerald-500"
        strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.75 }} />

      {points.map((point, index) => (
        <g key={`${point.label}-${point.currency ?? "value"}`}>
          {showPrevious ? (
            <circle cx={previous[index].x} cy={previous[index].y} r="4"
              className="fill-neutral-400 stroke-white dark:fill-neutral-500 dark:stroke-neutral-900" strokeWidth="2" />
          ) : null}
          <circle cx={current[index].x} cy={current[index].y} r="5.5"
            className="cursor-pointer fill-emerald-500 stroke-white dark:stroke-neutral-900" strokeWidth="2"
            role="button" tabIndex={0}
            onClick={() => {
              if (point.periodABucketStart && point.periodABucketEnd) {
                onPointSelect?.({
                  bucketStart: point.periodABucketStart,
                  bucketEnd: point.periodABucketEnd,
                  value: point.periodAValue,
                  metric: metric as StatisticsTimeSeriesPoint["metric"],
                  currency: point.currency
                });
              }
            }} />
          {points.length <= 8 ? (
            <text x={current[index].x} y={Math.max(current[index].y - 12, 12)} textAnchor="middle"
              className="fill-emerald-600 text-[10px] font-semibold dark:fill-emerald-400">
              {formatValue(Number(point.periodAValue), metric, currency, locale, true)}
            </text>
          ) : null}
        </g>
      ))}
      {labelIndexes(points.length).map((index) => (
        <text key={`${points[index].label}-${index}`} x={current[index].x} y={chart.height - 10}
          textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
          className="fill-neutral-500 text-[10px] font-medium dark:fill-white/40">
          {points[index].label}
        </text>
      ))}
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
