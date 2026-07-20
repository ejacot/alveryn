import { useTranslation } from "react-i18next";
import { formatCurrency, formatMinutesAsDuration } from "../../../utils/format";
import type {
  ProductivityGrouping,
  ProductivityMetric,
  StatisticsForecast,
  StatisticsHighlight,
  StatisticsHighlights,
  StatisticsInsight,
  StatisticsInsights,
  StatisticsProductivity
} from "../types/statistics";

type SectionStateProps = {
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
};

function numberValue(value: string | null | undefined) {
  return Number(value ?? 0);
}

function percent(value: string | null | undefined) {
  if (value == null) {
    return "";
  }
  const numeric = Number(value);
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(0)}%`;
}

function SectionStatus({
  isLoading,
  isError,
  onRetry
}: SectionStateProps) {
  const { t } = useTranslation("common");
  if (isLoading) {
    return <p className="text-sm text-white/50" role="status">{t("statistics.sections.loading")}</p>;
  }
  if (isError) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-white/50">{t("statistics.sections.error")}</p>
        <button type="button" onClick={onRetry} className="text-sm font-semibold text-white underline underline-offset-4">
          {t("statistics.sections.retry")}
        </button>
      </div>
    );
  }
  return null;
}

export function StatisticsInsightsSection({
  data,
  isLoading,
  isError,
  onRetry
}: { data: StatisticsInsights | undefined } & SectionStateProps) {
  const { t } = useTranslation("common");
  const insights = data?.insights ?? [];
  const status = <SectionStatus isLoading={isLoading} isError={isError} onRetry={onRetry} />;
  if (isLoading || isError) {
    return (
      <Card as="section" variant="section">
        <p className="hairline-text">{t("statistics.insights.eyebrow")}</p>
        <h2 className="mt-1 text-base font-semibold text-white">{t("statistics.insights.title")}</h2>
        <div className="mt-3">{status}</div>
      </Card>
    );
  }
  if (insights.length === 0) {
    return (
      <Card as="section" variant="section">
        <p className="hairline-text">{t("statistics.insights.eyebrow")}</p>
        <h2 className="mt-1 text-base font-semibold text-white">{t("statistics.insights.title")}</h2>
        <p className="mt-3 text-sm text-white/50">{t("statistics.insights.empty")}</p>
      </Card>
    );
  }
  return (
    <Card as="section" variant="section" className="space-y-3" aria-labelledby="statistics-insights-title">
      <div>
        <p className="hairline-text">{t("statistics.insights.eyebrow")}</p>
        <h2 id="statistics-insights-title" className="mt-1 text-base font-semibold text-white">
          {t("statistics.insights.title")}
        </h2>
      </div>
      <ul className="space-y-2">
        {insights.map((insight, index) => (
          <li key={`${insight.type}-${index}`} className="rounded-2xl bg-white/[0.035] px-4 py-3">
            <p className="text-sm font-medium text-white">{insightText(t, insight)}</p>
            <p className="mt-1 text-xs text-white/40">{t(`statistics.confidence.${insight.confidence}`)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function insightText(t: ReturnType<typeof useTranslation<"common">>["t"], insight: StatisticsInsight) {
  if (insight.type === "HOURS_CHANGE") {
    return t("statistics.insights.hoursChange", { value: percent(insight.percentage) });
  }
  if (insight.type === "WORKED_DAYS_CHANGE") {
    return t("statistics.insights.workedDaysChange", { value: percent(insight.percentage) });
  }
  if (insight.type === "BEST_WEEKDAY") {
    return t("statistics.insights.bestWeekday", { subject: insight.subject });
  }
  if (insight.type === "MOST_USED_WORK_TYPE") {
    return t("statistics.insights.mostUsedWorkType", { subject: insight.subject });
  }
  if (insight.type === "STREAK") {
    return t("statistics.insights.streak", { count: numberValue(insight.currentValue) });
  }
  return t("statistics.insights.generic");
}

export function StatisticsForecastSection({
  data,
  isLoading,
  isError,
  onRetry
}: { data: StatisticsForecast | undefined } & SectionStateProps) {
  const { t } = useTranslation("common");
  const forecasts = data?.forecasts ?? [];
  const status = <SectionStatus isLoading={isLoading} isError={isError} onRetry={onRetry} />;
  return (
    <Card as="section" variant="section" className="space-y-4" aria-labelledby="statistics-forecast-title">
      <div>
        <p className="hairline-text">{t("statistics.forecast.eyebrow")}</p>
        <h2 id="statistics-forecast-title" className="mt-1 text-base font-semibold text-white">
          {t("statistics.forecast.title")}
        </h2>
      </div>
      {isLoading || isError ? (
        status
      ) : forecasts.length === 0 ? (
        <p className="text-sm text-white/50">{t("statistics.forecast.empty")}</p>
      ) : (
        <div className="space-y-3">
          {forecasts.map((item) => (
            <div key={item.currency ?? "none"} className="rounded-[26px] bg-white/[0.035] p-4">
              {item.available ? (
                <>
                  <p className="text-xs text-white/45">{t("statistics.forecast.estimated")}</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-white">
                    {item.currency ? formatCurrency(item.projectedGross, item.currency) : item.projectedGross}
                  </p>
                  <p className="mt-2 text-sm text-white/55">
                    {t("statistics.forecast.range", {
                      from: item.currency ? formatCurrency(item.lowerBound, item.currency) : item.lowerBound,
                      to: item.currency ? formatCurrency(item.upperBound, item.currency) : item.upperBound
                    })}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/60">
                    <span className="rounded-full bg-white/10 px-3 py-1">
                      {t("statistics.forecast.current", {
                        value: item.currency ? formatCurrency(item.actualGross, item.currency) : item.actualGross
                      })}
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1">
                      {t(`statistics.confidence.${item.confidence}`)}
                    </span>
                  </div>
                  <details className="mt-4 rounded-2xl bg-black/20 px-3 py-2 text-xs text-white/50">
                    <summary className="cursor-pointer text-white/70">{t("statistics.forecast.details.title")}</summary>
                    <dl className="mt-3 grid gap-2">
                      <div className="flex justify-between gap-3">
                        <dt>{t("statistics.forecast.details.mode")}</dt>
                        <dd>{t(`statistics.forecast.modes.${data?.mode}`)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>{t("statistics.forecast.details.workedDays")}</dt>
                        <dd>{item.workedDays}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>{t("statistics.forecast.details.elapsedEligibleDays")}</dt>
                        <dd>{item.elapsedEligibleDays}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>{t("statistics.forecast.details.workFrequency")}</dt>
                        <dd>{percentFromRatio(item.observedWorkFrequency)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>{t("statistics.forecast.details.remainingEligibleDays")}</dt>
                        <dd>{item.remainingEligibleDays}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>{t("statistics.forecast.details.today")}</dt>
                        <dd>{item.todayIncludedInElapsed ? t("statistics.forecast.details.todayIncluded") : t("statistics.forecast.details.todayExcluded")}</dd>
                      </div>
                    </dl>
                  </details>
                </>
              ) : (
                <p className="text-sm text-white/55">{t(`statistics.forecast.reasons.${item.reason}` as never)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function StatisticsProductivitySection({
  data,
  isLoading,
  isError,
  onRetry,
  metric,
  grouping,
  onOptionsChange
}: {
  data: StatisticsProductivity | undefined;
  metric: ProductivityMetric;
  grouping: ProductivityGrouping;
  onOptionsChange: (metric: ProductivityMetric, grouping: ProductivityGrouping) => void;
} & SectionStateProps) {
  const { t } = useTranslation("common");
  if (isLoading || isError) {
    return (
      <Card as="section" variant="section">
        <p className="hairline-text">{t("statistics.productivity.eyebrow")}</p>
        <h2 className="mt-1 text-base font-semibold text-white">{t("statistics.productivity.title")}</h2>
        <div className="mt-3"><SectionStatus isLoading={isLoading} isError={isError} onRetry={onRetry} /></div>
      </Card>
    );
  }
  if (!data?.available) {
    return (
      <Card as="section" variant="section">
        <p className="hairline-text">{t("statistics.productivity.eyebrow")}</p>
        <h2 className="mt-1 text-base font-semibold text-white">{t("statistics.productivity.title")}</h2>
        <p className="mt-3 text-sm text-white/50">{t("statistics.productivity.empty")}</p>
      </Card>
    );
  }
  return (
    <Card as="section" variant="section" className="space-y-4" aria-labelledby="statistics-productivity-title">
      <div>
        <p className="hairline-text">{t("statistics.productivity.eyebrow")}</p>
        <h2 id="statistics-productivity-title" className="mt-1 text-base font-semibold text-white">
          {t("statistics.productivity.title")}
        </h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-white/45">
          {t("statistics.productivity.metric")}
          <select
            className="mt-1 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            value={metric}
            onChange={(event) => onOptionsChange(event.target.value as ProductivityMetric, grouping)}
          >
            <option value="TOTAL_UNITS">{t("statistics.productivity.metrics.TOTAL_UNITS")}</option>
            <option value="CONFIGURED_UNITS_PER_HOUR">{t("statistics.productivity.metrics.CONFIGURED_UNITS_PER_HOUR")}</option>
            <option value="EQUIVALENT_MINUTES">{t("statistics.productivity.metrics.EQUIVALENT_MINUTES")}</option>
          </select>
        </label>
        <label className="text-xs text-white/45">
          {t("statistics.productivity.grouping")}
          <select
            className="mt-1 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            value={grouping}
            onChange={(event) => onOptionsChange(metric, event.target.value as ProductivityGrouping)}
          >
            <option value="TOTAL">{t("statistics.productivity.groupings.TOTAL")}</option>
            <option value="DAILY">{t("statistics.productivity.groupings.DAILY")}</option>
            <option value="WEEKLY">{t("statistics.productivity.groupings.WEEKLY")}</option>
            <option value="MONTHLY">{t("statistics.productivity.groupings.MONTHLY")}</option>
          </select>
        </label>
      </div>
      <div className="rounded-[26px] bg-white/[0.035] p-4">
        <p className="text-3xl font-semibold text-white">{new Intl.NumberFormat().format(numberValue(data.totalUnits))}</p>
        <p className="mt-1 text-sm text-white/50">{t("statistics.productivity.units")}</p>
        <p className="mt-3 text-sm text-white/65">
          {t("statistics.productivity.configuredPace", {
            value: new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(numberValue(data.effectiveConfiguredUnitsPerHour))
          })}
        </p>
        <p className="mt-1 text-xs text-white/40">{t("statistics.productivity.actualUnavailable")}</p>
      </div>
      <div className="space-y-2">
        {data.workFormulas.map((item) => (
          <div key={item.workFormulaId} className="rounded-2xl bg-black/20 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-white">{item.name}</p>
                <p className="text-xs text-white/40">{item.workTypeName}</p>
              </div>
              <p className="text-sm font-semibold text-white">{new Intl.NumberFormat().format(numberValue(item.totalQuantity))}</p>
            </div>
            <p className="mt-2 text-xs text-white/45">
              {t("statistics.productivity.equivalent", {
                value: formatMinutesAsDuration(numberValue(item.equivalentMinutes))
              })}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function StatisticsHighlightsSection({
  data,
  isLoading,
  isError,
  onRetry
}: { data: StatisticsHighlights | undefined } & SectionStateProps) {
  const { t } = useTranslation("common");
  const highlights = (data?.highlights ?? []).slice(0, 4);
  if (isLoading || isError) {
    return (
      <Card as="section" variant="section">
        <p className="hairline-text">{t("statistics.highlights.eyebrow")}</p>
        <h2 className="mt-1 text-base font-semibold text-white">{t("statistics.highlights.title")}</h2>
        <div className="mt-3"><SectionStatus isLoading={isLoading} isError={isError} onRetry={onRetry} /></div>
      </Card>
    );
  }
  if (highlights.length === 0) {
    return null;
  }
  return (
    <Card as="section" variant="section" className="space-y-3" aria-labelledby="statistics-highlights-title">
      <div>
        <p className="hairline-text">{t("statistics.highlights.eyebrow")}</p>
        <h2 id="statistics-highlights-title" className="mt-1 text-base font-semibold text-white">
          {t("statistics.highlights.title")}
        </h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {highlights.map((highlight, index) => (
          <article key={`${highlight.type}-${highlight.currency ?? index}`} className="rounded-2xl bg-white/[0.035] p-4">
            <h3 className="text-xs text-white/40">
              {highlight.type === "BEST_GROSS_DAY" && highlight.currency
                ? t("statistics.highlights.bestGrossWithCurrency", { currency: highlight.currency })
                : t(`statistics.highlights.types.${highlight.type}` as never)}
            </h3>
            <p className="mt-2 text-lg font-semibold text-white">{highlightValue(t, highlight)}</p>
            {highlight.from ? <p className="mt-1 text-xs text-white/40">{highlight.from}</p> : null}
          </article>
        ))}
      </div>
    </Card>
  );
}

function highlightValue(t: ReturnType<typeof useTranslation<"common">>["t"], highlight: StatisticsHighlight) {
  if (highlight.type === "BEST_GROSS_DAY" && highlight.currency && highlight.numericValue) {
    return formatCurrency(highlight.numericValue, highlight.currency);
  }
  if (highlight.type === "BEST_HOURS_DAY" || highlight.type === "LONGEST_SHIFT" || highlight.type === "AVERAGE_SHIFT") {
    return formatMinutesAsDuration(numberValue(highlight.numericValue));
  }
  if (highlight.type === "MOST_USED_WORK_TYPE") {
    return highlight.label ?? "";
  }
  if (highlight.type === "CURRENT_STREAK" || highlight.type === "LONGEST_STREAK") {
    return t("statistics.highlights.days", { count: numberValue(highlight.numericValue) });
  }
  return new Intl.NumberFormat().format(numberValue(highlight.numericValue));
}

function percentFromRatio(value: string | null | undefined) {
  return `${Math.round(numberValue(value) * 100)}%`;
}
import { Card } from "../../../components/ui/card";
