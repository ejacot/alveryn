import { useTranslation } from "react-i18next";
import { formatCurrency, formatMinutesAsDuration } from "../../../utils/format";
import type {
  StatisticsForecast,
  StatisticsHighlight,
  StatisticsHighlights,
  StatisticsInsight,
  StatisticsInsights,
  StatisticsProductivity
} from "../types/statistics";

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

export function StatisticsInsightsSection({ data }: { data: StatisticsInsights | undefined }) {
  const { t } = useTranslation("common");
  const insights = data?.insights ?? [];
  if (insights.length === 0) {
    return (
      <section className="section-card">
        <p className="hairline-text">{t("statistics.insights.eyebrow")}</p>
        <h2 className="mt-1 text-base font-semibold text-white">{t("statistics.insights.title")}</h2>
        <p className="mt-3 text-sm text-white/50">{t("statistics.insights.empty")}</p>
      </section>
    );
  }
  return (
    <section className="section-card space-y-3" aria-labelledby="statistics-insights-title">
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
    </section>
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

export function StatisticsForecastSection({ data }: { data: StatisticsForecast | undefined }) {
  const { t } = useTranslation("common");
  const forecasts = data?.forecasts ?? [];
  return (
    <section className="section-card space-y-4" aria-labelledby="statistics-forecast-title">
      <div>
        <p className="hairline-text">{t("statistics.forecast.eyebrow")}</p>
        <h2 id="statistics-forecast-title" className="mt-1 text-base font-semibold text-white">
          {t("statistics.forecast.title")}
        </h2>
      </div>
      {forecasts.length === 0 ? (
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
                </>
              ) : (
                <p className="text-sm text-white/55">{t(`statistics.forecast.reasons.${item.reason}` as never)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function StatisticsProductivitySection({ data }: { data: StatisticsProductivity | undefined }) {
  const { t } = useTranslation("common");
  if (!data?.available) {
    return (
      <section className="section-card">
        <p className="hairline-text">{t("statistics.productivity.eyebrow")}</p>
        <h2 className="mt-1 text-base font-semibold text-white">{t("statistics.productivity.title")}</h2>
        <p className="mt-3 text-sm text-white/50">{t("statistics.productivity.empty")}</p>
      </section>
    );
  }
  return (
    <section className="section-card space-y-4" aria-labelledby="statistics-productivity-title">
      <div>
        <p className="hairline-text">{t("statistics.productivity.eyebrow")}</p>
        <h2 id="statistics-productivity-title" className="mt-1 text-base font-semibold text-white">
          {t("statistics.productivity.title")}
        </h2>
      </div>
      <div className="rounded-[26px] bg-white/[0.035] p-4">
        <p className="text-3xl font-semibold text-white">{new Intl.NumberFormat().format(numberValue(data.totalUnits))}</p>
        <p className="mt-1 text-sm text-white/50">{t("statistics.productivity.units")}</p>
        <p className="mt-3 text-sm text-white/65">
          {t("statistics.productivity.configuredPace", {
            value: new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(numberValue(data.configuredUnitsPerHour))
          })}
        </p>
        <p className="mt-1 text-xs text-white/40">{t("statistics.productivity.actualUnavailable")}</p>
      </div>
      <div className="space-y-2">
        {data.unitTypes.map((item) => (
          <div key={item.unitTypeId} className="rounded-2xl bg-black/20 px-4 py-3">
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
    </section>
  );
}

export function StatisticsHighlightsSection({ data }: { data: StatisticsHighlights | undefined }) {
  const { t } = useTranslation("common");
  const highlights = (data?.highlights ?? []).slice(0, 4);
  if (highlights.length === 0) {
    return null;
  }
  return (
    <section className="section-card space-y-3" aria-labelledby="statistics-highlights-title">
      <div>
        <p className="hairline-text">{t("statistics.highlights.eyebrow")}</p>
        <h2 id="statistics-highlights-title" className="mt-1 text-base font-semibold text-white">
          {t("statistics.highlights.title")}
        </h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {highlights.map((highlight) => (
          <article key={highlight.type} className="rounded-2xl bg-white/[0.035] p-4">
            <h3 className="text-xs text-white/40">{t(`statistics.highlights.types.${highlight.type}` as never)}</h3>
            <p className="mt-2 text-lg font-semibold text-white">{highlightValue(t, highlight)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function highlightValue(t: ReturnType<typeof useTranslation<"common">>["t"], highlight: StatisticsHighlight) {
  if (highlight.type === "BEST_GROSS_DAY" && highlight.grossByCurrency[0]) {
    return formatCurrency(highlight.grossByCurrency[0].amount, highlight.grossByCurrency[0].currency);
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
