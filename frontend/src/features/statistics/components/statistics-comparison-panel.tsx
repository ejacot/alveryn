import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { queryKeys } from "../../../api/query-keys";
import { formatCurrency, formatHours, formatMinutesAsDuration } from "../../../utils/format";
import { getStatisticsComparison, getStatisticsDrilldown } from "../api/statistics-api";
import {
  currentWeekElapsedRange,
  firstHalfRange,
  formatLocalDate,
  monthRange,
  previousEqualRange,
  yearRange,
  ytdRange
} from "../filters/statistics-date-utils";
import type {
  StatisticsAdvancedComparison,
  StatisticsComparisonRequest,
  StatisticsComparisonSeriesPoint,
  StatisticsFilters,
  StatisticsMetric
} from "../types/statistics";

type Props = {
  filters: StatisticsFilters;
};

type Preset = "week" | "month" | "year" | "sameMonthPreviousYear" | "ytd" | "custom";
type Period = { from: string; to: string };

const comparisonMetrics: StatisticsMetric[] = ["GROSS", "WORKED_HOURS", "WORKED_DAYS", "ENTRIES"];
const presets: Preset[] = ["week", "month", "year", "sameMonthPreviousYear", "ytd", "custom"];

function isMetric(value: string | null): value is StatisticsMetric {
  return Boolean(value && comparisonMetrics.includes(value as StatisticsMetric));
}

function isPreset(value: string | null): value is Preset {
  return Boolean(value && presets.includes(value as Preset));
}

function parsePeriod(from: string | null, to: string | null): Period | null {
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return null;
  }
  return { from, to };
}

function sameMonthPreviousYear(period: Period): Period {
  const from = new Date(`${period.from}T00:00:00`);
  return {
    from: formatLocalDate(new Date(from.getFullYear() - 1, from.getMonth(), 1)),
    to: formatLocalDate(new Date(from.getFullYear() - 1, from.getMonth() + 1, 0))
  };
}

function periodsForPreset(preset: Preset, filters: StatisticsFilters): { periodA: Period; periodB: Period } {
  const now = new Date();
  if (preset === "week") {
    return currentWeekElapsedRange(now);
  }
  if (preset === "year") {
    return { periodA: yearRange(now, 0), periodB: yearRange(now, -1) };
  }
  if (preset === "sameMonthPreviousYear") {
    const periodA = monthRange(now, 0);
    return { periodA, periodB: sameMonthPreviousYear(periodA) };
  }
  if (preset === "ytd") {
    return { periodA: ytdRange(now, 0), periodB: ytdRange(now, -1) };
  }
  if (preset === "custom") {
    const periodA = { from: filters.from, to: filters.to };
    return { periodA, periodB: previousEqualRange(periodA.from, periodA.to) };
  }
  return { periodA: monthRange(now, 0), periodB: monthRange(now, -1) };
}

function requestFor(
  filters: StatisticsFilters,
  periodA: Period,
  periodB: Period,
  metric: StatisticsMetric
): StatisticsComparisonRequest {
  return {
    periodA,
    periodB,
    metric,
    workTypeIds: filters.workTypeIds,
    calculationMethods: filters.calculationMethods
  };
}

function formatDifferenceValue(value: string, currency: string | null, metric: StatisticsMetric) {
  if (currency) {
    return formatCurrency(value, currency);
  }
  if (metric === "WORKED_HOURS") {
    return formatHours(value);
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(Number(value));
}

function seriesPosition(value: string, index: number, points: StatisticsComparisonSeriesPoint[], selector: "periodAValue" | "periodBValue") {
  const allValues = points.flatMap((point) => [Number(point.periodAValue), Number(point.periodBValue)]);
  const max = Math.max(...allValues, 1);
  const min = Math.min(...allValues, 0);
  const span = Math.max(max - min, 1);
  return {
    x: points.length === 1 ? 100 : (index / (points.length - 1)) * 200,
    y: 92 - ((Number(value) - min) / span) * 76,
    selector
  };
}

function pathFor(points: StatisticsComparisonSeriesPoint[], selector: "periodAValue" | "periodBValue") {
  return points
    .map((point, index) => {
      const position = seriesPosition(point[selector], index, points, selector);
      return `${index === 0 ? "M" : "L"} ${position.x.toFixed(2)} ${position.y.toFixed(2)}`;
    })
    .join(" ");
}

function labelForPoint(t: TFunction<"common">, comparison: StatisticsAdvancedComparison, point: StatisticsComparisonSeriesPoint, index: number) {
  const label = point.label;
  if (comparison.series.alignment === "RELATIVE_DAY") {
    return t("statistics.comparison.alignment.relativeDay", { count: index + 1 });
  }
  if (comparison.series.alignment === "RELATIVE_WEEK") {
    return t("statistics.comparison.alignment.relativeWeek", { count: index + 1 });
  }
  if (comparison.series.alignment === "MONTH_OF_YEAR") {
    return t(`statistics.months.${label.toLowerCase()}` as never, label.slice(0, 3));
  }
  if (comparison.series.alignment === "DAY_OF_WEEK") {
    return t(`statistics.weekdays.${label.toLowerCase()}` as never, label.slice(0, 3));
  }
  return label;
}

export function StatisticsComparisonPanel({ filters }: Props) {
  const { t } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPreset = isPreset(searchParams.get("comparePreset")) ? searchParams.get("comparePreset") as Preset : "month";
  const initialMetric = isMetric(searchParams.get("compareMetric")) ? searchParams.get("compareMetric") as StatisticsMetric : filters.metric;
  const initialPeriods = periodsForPreset(initialPreset, filters);
  const urlPeriodA = parsePeriod(searchParams.get("compareAFrom"), searchParams.get("compareATo"));
  const urlPeriodB = parsePeriod(searchParams.get("compareBFrom"), searchParams.get("compareBTo"));
  const [preset, setPresetState] = useState<Preset>(initialPreset);
  const [metric, setMetricState] = useState<StatisticsMetric>(isMetric(initialMetric) ? initialMetric : "GROSS");
  const [periodA, setPeriodA] = useState<Period>(urlPeriodA ?? initialPeriods.periodA);
  const [periodB, setPeriodB] = useState<Period>(urlPeriodB ?? initialPeriods.periodB);
  const [draftA, setDraftA] = useState<Period>(periodA);
  const [draftB, setDraftB] = useState<Period>(periodB);
  const [customOpen, setCustomOpen] = useState(initialPreset === "custom");
  const [selectedPoint, setSelectedPoint] = useState<StatisticsComparisonSeriesPoint | null>(null);

  useEffect(() => {
    const nextPreset = isPreset(searchParams.get("comparePreset")) ? searchParams.get("comparePreset") as Preset : "month";
    const nextMetric = isMetric(searchParams.get("compareMetric")) ? searchParams.get("compareMetric") as StatisticsMetric : filters.metric;
    const nextPeriods = periodsForPreset(nextPreset, filters);
    const nextPeriodA = parsePeriod(searchParams.get("compareAFrom"), searchParams.get("compareATo")) ?? nextPeriods.periodA;
    const nextPeriodB = parsePeriod(searchParams.get("compareBFrom"), searchParams.get("compareBTo")) ?? nextPeriods.periodB;
    setPresetState(nextPreset);
    setMetricState(isMetric(nextMetric) ? nextMetric : "GROSS");
    setPeriodA(nextPeriodA);
    setPeriodB(nextPeriodB);
    setDraftA(nextPeriodA);
    setDraftB(nextPeriodB);
  }, [filters, searchParams]);

  function writeComparison(nextPreset: Preset, nextMetric: StatisticsMetric, nextA: Period, nextB: Period) {
    const params =
      typeof window === "undefined"
        ? new URLSearchParams(searchParams)
        : new URLSearchParams(window.location.search);
    params.set("comparePreset", nextPreset);
    params.set("compareMetric", nextMetric);
    params.set("compareAFrom", nextA.from);
    params.set("compareATo", nextA.to);
    params.set("compareBFrom", nextB.from);
    params.set("compareBTo", nextB.to);
    setSearchParams(params, { replace: true });
  }

  function applyPreset(nextPreset: Preset) {
    if (nextPreset === "custom") {
      setCustomOpen(true);
      writeComparison("custom", metric, periodA, periodB);
      return;
    }
    const next = periodsForPreset(nextPreset, filters);
    setCustomOpen(false);
    setSelectedPoint(null);
    writeComparison(nextPreset, metric, next.periodA, next.periodB);
  }

  function applyMetric(nextMetric: StatisticsMetric) {
    setSelectedPoint(null);
    writeComparison(preset, nextMetric, periodA, periodB);
  }

  function applyCustom(nextA = draftA, nextB = draftB) {
    if (nextA.from > nextA.to || nextB.from > nextB.to) {
      return;
    }
    setCustomOpen(false);
    setSelectedPoint(null);
    writeComparison("custom", metric, nextA, nextB);
  }

  function cancelCustom() {
    setDraftA(periodA);
    setDraftB(periodB);
    setCustomOpen(false);
  }

  function applyQuick(action: "month" | "year" | "ytd" | "firstHalf" | "sameDuration") {
    const now = new Date();
    const next =
      action === "month"
        ? { periodA: monthRange(now, 0), periodB: monthRange(now, -1) }
        : action === "year"
          ? { periodA: yearRange(now, 0), periodB: yearRange(now, -1) }
          : action === "ytd"
            ? { periodA: ytdRange(now, 0), periodB: ytdRange(now, -1) }
            : action === "firstHalf"
              ? { periodA: firstHalfRange(now, 0), periodB: firstHalfRange(now, -1) }
              : { periodA: draftA, periodB: previousEqualRange(draftA.from, draftA.to) };
    setDraftA(next.periodA);
    setDraftB(next.periodB);
  }

  const request = useMemo(() => requestFor(filters, periodA, periodB, metric), [filters, periodA, periodB, metric]);
  const comparison = useQuery({
    queryKey: queryKeys.statistics.comparison({
      ...request,
      workTypeIds: [...request.workTypeIds].sort(),
      calculationMethods: [...request.calculationMethods].sort()
    }),
    queryFn: () => getStatisticsComparison(request),
    placeholderData: (previous) => previous
  });

  const selectedA = selectedPoint?.periodABucketStart && selectedPoint.periodABucketEnd
    ? { ...filters, from: selectedPoint.periodABucketStart, to: selectedPoint.periodABucketEnd }
    : null;
  const selectedB = selectedPoint?.periodBBucketStart && selectedPoint.periodBBucketEnd
    ? { ...filters, from: selectedPoint.periodBBucketStart, to: selectedPoint.periodBBucketEnd }
    : null;
  const drilldownA = useQuery({
    queryKey: queryKeys.statistics.drilldown({
      from: selectedA?.from ?? "none",
      to: selectedA?.to ?? "none",
      workTypeIds: selectedA ? [...selectedA.workTypeIds].sort() : [],
      calculationMethods: selectedA ? [...selectedA.calculationMethods].sort() : []
    }),
    queryFn: () => getStatisticsDrilldown(selectedA ?? filters),
    enabled: Boolean(selectedA)
  });
  const drilldownB = useQuery({
    queryKey: queryKeys.statistics.drilldown({
      from: selectedB?.from ?? "none",
      to: selectedB?.to ?? "none",
      workTypeIds: selectedB ? [...selectedB.workTypeIds].sort() : [],
      calculationMethods: selectedB ? [...selectedB.calculationMethods].sort() : []
    }),
    queryFn: () => getStatisticsDrilldown(selectedB ?? filters),
    enabled: Boolean(selectedB)
  });

  const groupedPoints = useMemo(() => {
    const groups = new Map<string, StatisticsComparisonSeriesPoint[]>();
    for (const point of comparison.data?.series.points ?? []) {
      const key = point.currency ?? "value";
      groups.set(key, [...(groups.get(key) ?? []), point]);
    }
    return Array.from(groups.entries());
  }, [comparison.data?.series.points]);

  return (
    <section className="section-card space-y-4" aria-labelledby="statistics-comparison-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/35">{t("statistics.comparison.eyebrow")}</p>
          <h2 id="statistics-comparison-title" className="text-base font-semibold text-white">
            {t("statistics.comparison.title")}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={preset}
            onChange={(event) => applyPreset(event.target.value as Preset)}
            className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
            aria-label={t("statistics.comparison.preset")}
          >
            <option value="week">{t("statistics.comparison.presets.week")}</option>
            <option value="month">{t("statistics.comparison.presets.month")}</option>
            <option value="year">{t("statistics.comparison.presets.year")}</option>
            <option value="sameMonthPreviousYear">{t("statistics.comparison.presets.sameMonthPreviousYear")}</option>
            <option value="ytd">{t("statistics.comparison.presets.ytd")}</option>
            <option value="custom">{t("statistics.comparison.presets.custom")}</option>
          </select>
          <select
            value={metric}
            onChange={(event) => applyMetric(event.target.value as StatisticsMetric)}
            className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
            aria-label={t("statistics.comparison.metric")}
          >
            {comparisonMetrics.map((item) => (
              <option key={item} value={item}>{t(`statistics.metrics.${item}` as never)}</option>
            ))}
          </select>
        </div>
      </div>

      {customOpen ? (
        <div className="rounded-[26px] bg-white/[0.035] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/50">
              {t("statistics.comparison.periodAFrom")}
              <input type="date" value={draftA.from} onChange={(event) => setDraftA((current) => ({ ...current, from: event.target.value }))} className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-xs text-white/50">
              {t("statistics.comparison.periodATo")}
              <input type="date" value={draftA.to} onChange={(event) => setDraftA((current) => ({ ...current, to: event.target.value }))} className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-xs text-white/50">
              {t("statistics.comparison.periodBFrom")}
              <input type="date" value={draftB.from} onChange={(event) => setDraftB((current) => ({ ...current, from: event.target.value }))} className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-xs text-white/50">
              {t("statistics.comparison.periodBTo")}
              <input type="date" value={draftB.to} onChange={(event) => setDraftB((current) => ({ ...current, to: event.target.value }))} className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white" />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["month", "year", "ytd", "firstHalf", "sameDuration"] as const).map((action) => (
              <button key={action} type="button" onClick={() => applyQuick(action)} className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white">
                {t(`statistics.comparison.quick.${action}` as never)}
              </button>
            ))}
          </div>
          {(draftA.from > draftA.to || draftB.from > draftB.to) ? (
            <p className="mt-3 text-sm text-red-200">{t("statistics.comparison.invalidRange")}</p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => applyCustom()} disabled={draftA.from > draftA.to || draftB.from > draftB.to} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
              {t("actions.apply")}
            </button>
            <button type="button" onClick={cancelCustom} className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white">
              {t("actions.cancel")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[24px] bg-white/[0.035] p-4">
          <p className="text-xs text-white/40">{t("statistics.comparison.periodA")}</p>
          <p className="mt-1 text-sm font-medium text-white">{periodA.from} – {periodA.to}</p>
        </div>
        <div className="rounded-[24px] bg-white/[0.035] p-4">
          <p className="text-xs text-white/40">{t("statistics.comparison.periodB")}</p>
          <p className="mt-1 text-sm font-medium text-white">{periodB.from} – {periodB.to}</p>
        </div>
      </div>

      <div className="space-y-2">
        {(comparison.data?.differences ?? []).map((difference) => (
          <div key={difference.currency ?? "value"} className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">{difference.currency ?? t(`statistics.metrics.${comparison.data?.metric}` as never)}</p>
              <p className="text-xs text-white/45">
                {difference.available ? t("statistics.comparison.percentage", { value: difference.percentage }) : t("statistics.comparison.unavailable")}
              </p>
            </div>
            <p className="text-lg font-semibold text-white">
              {formatDifferenceValue(difference.absolute, difference.currency, comparison.data?.metric ?? metric)}
            </p>
          </div>
        ))}
      </div>

      {comparison.data && groupedPoints.length > 0 ? (
        <div className="space-y-4">
          {groupedPoints.map(([key, points]) => (
            <div key={key} className="rounded-[26px] bg-white/[0.025] p-3">
              <div className="mb-3 flex items-center justify-between text-xs text-white/45">
                <span>{key === "value" ? t(`statistics.metrics.${comparison.data.metric}` as never) : key}</span>
                <span>{t(`statistics.comparison.alignment.${comparison.data.series.alignment}` as never, comparison.data.series.alignment)}</span>
              </div>
              <svg role="img" aria-label={t("statistics.comparison.chartAriaLabel")} viewBox="0 0 200 110" className="h-40 w-full" preserveAspectRatio="none">
                <path d="M 0 92 L 200 92" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                <path d={pathFor(points, "periodAValue")} fill="none" stroke="rgba(255,255,255,0.92)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                <path d={pathFor(points, "periodBValue")} fill="none" stroke="rgba(255,255,255,0.45)" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 5" strokeWidth="3" />
                {points.map((point, index) => {
                  const a = seriesPosition(point.periodAValue, index, points, "periodAValue");
                  const b = seriesPosition(point.periodBValue, index, points, "periodBValue");
                  return (
                    <g key={`${point.label}-${point.currency ?? "value"}`}>
                      {[a, b].map((position) => (
                        <circle
                          key={position.selector}
                          role="button"
                          tabIndex={0}
                          aria-label={t("statistics.comparison.pointAriaLabel", { label: labelForPoint(t, comparison.data, point, index) })}
                          cx={position.x}
                          cy={position.y}
                          r="4"
                          fill={position.selector === "periodAValue" ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.55)"}
                          className="cursor-pointer outline-none"
                          onClick={() => setSelectedPoint(point)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedPoint(point);
                            }
                          }}
                        />
                      ))}
                    </g>
                  );
                })}
              </svg>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-white/40">
                {points.slice(0, 3).map((point, index) => (
                  <span key={`${point.label}-${index}`}>{labelForPoint(t, comparison.data, point, index)}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {selectedPoint ? (
        <div className="rounded-[26px] bg-white/[0.035] p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">{t("statistics.comparison.details")}</h3>
            <button type="button" onClick={() => setSelectedPoint(null)} aria-label={t("actions.close")} className="rounded-full bg-white/10 p-2 text-white">
              <X size={16} />
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[{ label: t("statistics.comparison.periodA"), query: drilldownA }, { label: t("statistics.comparison.periodB"), query: drilldownB }].map((item) => (
              <div key={item.label} className="rounded-2xl bg-black/20 p-3">
                <p className="text-xs text-white/40">{item.label}</p>
                {item.query.data ? (
                  <>
                    <p className="mt-1 text-sm font-medium text-white">{item.query.data.from} – {item.query.data.to}</p>
                    <p className="mt-2 text-sm text-white/65">{formatMinutesAsDuration(Number(item.query.data.totals.workedMinutes))} · {t("statistics.entriesCount", { count: item.query.data.totals.entries })}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.query.data.totals.grossByCurrency.map((amount) => (
                        <span key={amount.currency} className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-white/65">
                          {formatCurrency(amount.amount, amount.currency)}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-white/50">{t("common.loading")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
