import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { listWorkEntriesForDay } from "../../../api/endpoints";
import { queryKeys } from "../../../api/query-keys";
import { formatCurrency, formatMinutesAsDuration } from "../../../utils/format";
import type { WorkEntry } from "../../../types/work-entry";
import { formatLocalDate } from "../filters/statistics-date-utils";
import type { StatisticsHeatmap, StatisticsHeatmapDay, StatisticsHeatmapMetric } from "../types/statistics";

type Props = {
  heatmap: StatisticsHeatmap | undefined;
  isLoading: boolean;
  isError: boolean;
  metric: StatisticsHeatmapMetric;
  currency: string | null;
  availableCurrencies: string[];
  onOptionsChange: (metric: StatisticsHeatmapMetric, currency: string | null) => void;
  onRetry: () => void;
  selectedDay: string | null;
  onSelectDay: (date: string) => void;
};

function intensity(day: StatisticsHeatmapDay, maximum: string) {
  const max = Number(maximum);
  if (max <= 0) {
    return 0;
  }
  return Math.min(1, Number(day.value) / max);
}

function entryLabel(entry: WorkEntry) {
  if (entry.calculationMethod === "UNIT_BASED") {
    return entry.unitItems.map((item) => `${item.unitName} ${item.quantity}`).join(" · ");
  }
  return entry.timeEntry ? `${entry.timeEntry.startTime.slice(0, 5)} – ${entry.timeEntry.endTime.slice(0, 5)}` : "";
}

export function StatisticsHeatmap({
  heatmap,
  isLoading,
  isError,
  metric,
  currency,
  availableCurrencies,
  onOptionsChange,
  onRetry,
  selectedDay,
  onSelectDay
}: Props) {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const dayEntries = useQuery({
    queryKey: selectedDay ? queryKeys.workEntries.day(selectedDay) : ["work-entries", "day", "none"],
    queryFn: () => listWorkEntriesForDay(selectedDay ?? ""),
    enabled: Boolean(selectedDay)
  });

  const selected = heatmap?.days.find((day) => day.date === selectedDay);

  return (
    <section
      className="section-card space-y-4"
      aria-labelledby="statistics-heatmap-title"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/35">{t("statistics.heatmap.eyebrow")}</p>
          <h2 id="statistics-heatmap-title" className="text-base font-semibold text-white">
            {t("statistics.heatmap.title")}
          </h2>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <select
            aria-label={t("statistics.heatmap.metric")}
            value={metric}
            onChange={(event) => onOptionsChange(event.target.value as StatisticsHeatmapMetric, null)}
            className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs text-white outline-none"
          >
            <option value="WORKED_HOURS">{t("statistics.metrics.WORKED_HOURS")}</option>
            <option value="WORKED_MINUTES">{t("statistics.metrics.WORKED_MINUTES")}</option>
            <option value="ENTRIES">{t("statistics.metrics.ENTRIES")}</option>
            <option value="GROSS">{t("statistics.metrics.GROSS")}</option>
          </select>
          {metric === "GROSS" && availableCurrencies.length > 1 ? (
            <select
              aria-label={t("statistics.heatmap.currency")}
              value={currency ?? ""}
              onChange={(event) => onOptionsChange(metric, event.target.value || null)}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs text-white outline-none"
            >
              <option value="">{t("statistics.heatmap.chooseCurrency")}</option>
              {availableCurrencies.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>
      {isError ? (
        <div className="rounded-[24px] bg-white/[0.035] p-4">
          <p className="text-sm font-medium text-white">
            {metric === "GROSS" ? t("statistics.heatmap.grossCurrencyRequired") : t("statistics.heatmap.error")}
          </p>
          <button type="button" onClick={onRetry} className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
            {t("actions.retry")}
          </button>
        </div>
      ) : isLoading || !heatmap ? (
        <div className="h-36 rounded-[24px] bg-white/[0.035]" />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label={t("statistics.heatmap.ariaLabel")}>
        {heatmap.days.map((day) => {
          const level = intensity(day, heatmap.maximum);
          const isSelected = day.date === selectedDay;
          const isToday = day.date === formatLocalDate(new Date());
          return (
            <button
              key={day.date}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-label={t("statistics.heatmap.dayAriaLabel", {
                date: new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" }).format(new Date(`${day.date}T00:00:00`)),
                hours: formatMinutesAsDuration(Number(day.workedMinutes)),
                entries: day.entries,
                absence: day.hasAbsence ? t("statistics.heatmap.absence") : ""
              })}
              onClick={() => onSelectDay(day.date)}
              className={[
                "relative aspect-square min-h-9 rounded-xl border transition",
                isSelected ? "border-white bg-white/25" : "border-white/5 bg-white/[0.04]",
                isToday ? "ring-1 ring-white/45" : ""
              ].join(" ")}
              style={{ backgroundColor: `rgba(255,255,255,${0.04 + level * 0.22})` }}
            >
              <span className="sr-only">{day.date}</span>
              {day.hasAbsence ? (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white/70" />
              ) : null}
            </button>
          );
        })}
          </div>
          {selected ? (
        <div className="rounded-[26px] bg-white/[0.035] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {new Intl.DateTimeFormat(i18n.language, { dateStyle: "full" }).format(
                  new Date(`${selected.date}T00:00:00`)
                )}
              </h3>
              <p className="mt-1 text-sm text-white/55">
                {formatMinutesAsDuration(Number(selected.workedMinutes))} · {t("statistics.entriesCount", { count: selected.entries })}
              </p>
            </div>
            {selected.hasAbsence ? (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
                {t("statistics.heatmap.absence")}
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.grossByCurrency.map((amount) => (
              <span key={amount.currency} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                {formatCurrency(amount.amount, amount.currency)}
              </span>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {(dayEntries.data ?? []).map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => navigate(`/entries/${entry.id}/edit`, { state: { from: "/statistics" } })}
                className="w-full rounded-2xl bg-black/20 px-4 py-3 text-left transition active:scale-[0.99]"
              >
                <p className="font-medium text-white">{entry.workTypeName}</p>
                <p className="mt-1 text-sm text-white/50">{entryLabel(entry)}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/calendar?date=${selected.date}`)}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white"
            >
              <CalendarDays size={16} />
              {t("statistics.heatmap.openCalendar")}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/entries/new?date=${selected.date}`, { state: { from: "/statistics" } })}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              <Plus size={16} />
              {t("statistics.heatmap.addEntry")}
            </button>
          </div>
        </div>
          ) : null}
        </>
      )}
    </section>
  );
}
