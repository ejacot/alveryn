import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Select } from "../../../components/ui/select";
import { Card } from "../../../components/ui/card";
import type { WorkType } from "../../../types/configuration";
import type { CalculationMethod } from "../../../types/work-calculation";
import {
  formatStatisticsDate,
  updateStatisticsCalculationMethod,
  updateStatisticsCustomRange,
  updateStatisticsMetric,
  updateStatisticsPeriod,
  updateStatisticsWorkTypes
} from "../filters/statistics-filter-state";
import type { StatisticsFilters, StatisticsMetric, StatisticsPeriod } from "../types/statistics";

type Props = {
  filters: StatisticsFilters;
  workTypes: WorkType[];
  onChange: (filters: StatisticsFilters) => void;
};

export function StatisticsFilterBar({ filters, workTypes, onChange }: Props) {
  const { t } = useTranslation("common");
  const [draftFrom, setDraftFrom] = useState(filters.from);
  const [draftTo, setDraftTo] = useState(filters.to);
  const [advancedOpen, setAdvancedOpen] = useState(
    filters.period === "custom" ||
      filters.workTypeIds.length > 0 ||
      filters.calculationMethods.length > 0
  );
  const periods: StatisticsPeriod[] = ["today", "week", "month", "year"];
  const activeAdvancedFilters =
    filters.workTypeIds.length + filters.calculationMethods.length;
  const activeWorkTypeLabel =
    filters.workTypeIds.length === 0
      ? t("statistics.filters.all")
      : t("statistics.filters.selectedCount", { count: filters.workTypeIds.length });

  function applyQuickRange(days: number) {
    const to = new Date();
    const from = new Date(to);
    from.setDate(to.getDate() - days + 1);
    setDraftFrom(formatStatisticsDate(from));
    setDraftTo(formatStatisticsDate(to));
  }

  return (
    <Card
      as="section"
      variant="section"
      aria-label={t("statistics.filters.label")}
      className="space-y-4"
    >
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {periods.map((period) => (
          <button
            key={period}
            type="button"
            aria-pressed={filters.period === period}
            onClick={() => onChange(updateStatisticsPeriod(filters, period))}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${
              filters.period === period
                ? "bg-white text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)]"
                : "bg-white/[0.055] text-white/58 hover:bg-white/[0.09] hover:text-white"
            }`}
          >
            {t(`statistics.periods.${period}`)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={filters.period === "custom"}
          onClick={() => {
            onChange(updateStatisticsPeriod(filters, "custom"));
            setAdvancedOpen(true);
          }}
          className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${
            filters.period === "custom"
              ? "bg-white text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)]"
              : "bg-white/[0.055] text-white/58 hover:bg-white/[0.09] hover:text-white"
          }`}
        >
          {t("statistics.periods.custom")}
        </button>
      </div>

      <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Select
          label={t("statistics.filters.metric")}
          value={filters.metric}
          onChange={(event) => onChange(updateStatisticsMetric(filters, event.target.value as StatisticsMetric))}
        >
          <option value="GROSS">{t("statistics.metrics.gross")}</option>
          <option value="WORKED_MINUTES">{t("statistics.metrics.workedMinutes")}</option>
          <option value="WORKED_HOURS">{t("statistics.metrics.workedHours")}</option>
          <option value="WORKED_DAYS">{t("statistics.metrics.workedDays")}</option>
          <option value="ENTRIES">{t("statistics.metrics.entries")}</option>
        </Select>
        <button
          type="button"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((current) => !current)}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.045] px-4 text-sm font-semibold text-white/68 transition hover:bg-white/[0.08] hover:text-white"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t("statistics.filters.more")}
          {activeAdvancedFilters > 0 ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[0.68rem] text-black">
              {activeAdvancedFilters}
            </span>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {advancedOpen ? (
        <div className="grid gap-3 border-t border-white/[0.07] pt-4 sm:grid-cols-2">
          <Select
            label={t("statistics.filters.workType")}
            value=""
            onChange={(event) => {
              const value = event.target.value;
              if (!value) {
                onChange(updateStatisticsWorkTypes(filters, []));
                return;
              }
              const next = filters.workTypeIds.includes(value)
                ? filters.workTypeIds.filter((id) => id !== value)
                : [...filters.workTypeIds, value];
              onChange(updateStatisticsWorkTypes(filters, next));
            }}
          >
            <option value="">{activeWorkTypeLabel}</option>
            {workTypes.map((workType) => (
              <option key={workType.id} value={workType.id}>
                {filters.workTypeIds.includes(workType.id) ? "✓ " : ""}
                {workType.name}
              </option>
            ))}
          </Select>
          <Select
            label={t("statistics.filters.calculationMethod")}
            value={filters.calculationMethods[0] ?? ""}
            onChange={(event) =>
              onChange(
                updateStatisticsCalculationMethod(
                  filters,
                  event.target.value as "" | CalculationMethod
                )
              )
            }
          >
            <option value="">{t("statistics.filters.all")}</option>
            <option value="TIME_BASED">{t("statistics.methods.time")}</option>
            <option value="UNIT_BASED">{t("statistics.methods.unit")}</option>
            <option value="FIXED_PRICE_BASED">{t("statistics.methods.fixed")}</option>
          </Select>
        </div>
      ) : null}

      {filters.period === "custom" ? (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-white/60">
              {t("statistics.customRange.from")}
              <input
                type="date"
                value={draftFrom}
                onChange={(event) => setDraftFrom(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base text-white outline-none focus:border-white/30"
              />
            </label>
            <label className="text-xs font-medium text-white/60">
              {t("statistics.customRange.to")}
              <input
                type="date"
                value={draftTo}
                onChange={(event) => setDraftTo(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base text-white outline-none focus:border-white/30"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => applyQuickRange(days)}
                className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white"
              >
                {t(`statistics.customRange.last${days}` as never)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setDraftFrom(formatStatisticsDate(new Date(now.getFullYear(), 0, 1)));
                setDraftTo(formatStatisticsDate(new Date(now.getFullYear(), 11, 31)));
              }}
              className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white"
            >
              {t("statistics.customRange.currentYear")}
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setDraftFrom(formatStatisticsDate(new Date(now.getFullYear() - 1, 0, 1)));
                setDraftTo(formatStatisticsDate(new Date(now.getFullYear() - 1, 11, 31)));
              }}
              className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white"
            >
              {t("statistics.customRange.previousYear")}
            </button>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftFrom(filters.from);
                setDraftTo(filters.to);
              }}
              className="rounded-full px-4 py-2 text-sm font-medium text-white/60"
            >
              {t("actions.cancel")}
            </button>
            <button
              type="button"
              disabled={!draftFrom || !draftTo || draftTo < draftFrom}
              onClick={() => onChange(updateStatisticsCustomRange(filters, draftFrom, draftTo))}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              {t("actions.apply")}
            </button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
