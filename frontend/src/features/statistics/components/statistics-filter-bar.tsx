import { useRef, useState } from "react";
import { BriefcaseBusiness, Check, ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Select } from "../../../components/ui/select";
import { Card } from "../../../components/ui/card";
import type { Employment, WorkType } from "../../../types/configuration";
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
  employments: Employment[];
  employmentIds: string[];
  onEmploymentsChange: (ids: string[]) => void;
  onChange: (filters: StatisticsFilters) => void;
};

export function StatisticsFilterBar({ filters, workTypes, employments, employmentIds, onEmploymentsChange, onChange }: Props) {
  const { t } = useTranslation("common");
  const [draftFrom, setDraftFrom] = useState(filters.from);
  const [draftTo, setDraftTo] = useState(filters.to);
  const [advancedOpen, setAdvancedOpen] = useState(
    filters.workTypeIds.length > 0 ||
      filters.calculationMethods.length > 0
  );
  const periods: StatisticsPeriod[] = ["week", "month", "year", "custom"];
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
      className="space-y-5 overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="hairline-text">{t("statistics.filters.period")}</p>
        </div>
        {employments.length > 1 ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-semibold text-white/62">
            <BriefcaseBusiness className="h-3.5 w-3.5" />
            {employmentIds.length === 0 ? t("statistics.filters.allEmployments") : t("statistics.filters.selectedCount", { count: employmentIds.length })}
          </span>
        ) : null}
      </div>
      <div
        role="group"
        aria-label={t("statistics.filters.period")}
        className="grid grid-cols-4 gap-[3px] rounded-[15px] border border-white/[0.07] bg-black/25 p-[3px] shadow-inner"
      >
        {periods.map((period) => (
          <button
            key={period}
            type="button"
            aria-pressed={filters.period === period}
            onClick={() => onChange(updateStatisticsPeriod(filters, period))}
            className={`min-h-9 min-w-0 rounded-[12px] px-1.5 text-[0.78rem] font-semibold transition duration-200 sm:px-3 sm:text-sm ${
              filters.period === period
                ? "bg-white/[0.14] text-white shadow-[0_1px_4px_rgba(0,0,0,0.35),inset_0_0_0_0.5px_rgba(255,255,255,0.12)]"
                : "text-white/48 active:bg-white/[0.07]"
            }`}
          >
            {t(`statistics.periods.${period}`)}
          </button>
        ))}
      </div>

      {filters.period !== "custom" && filters.period !== "today" ? (
        <PeriodNavigator filters={filters} onChange={onChange} />
      ) : null}

      {employments.length > 1 ? (
        <div className="border-t border-white/[0.07] pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/38">{t("statistics.filters.employment")}</p>
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip active={employmentIds.length === 0} label={t("statistics.filters.all")} onClick={() => onEmploymentsChange([])} />
            {employments.map((employment) => (
              <FilterChip
                key={employment.id}
                active={employmentIds.includes(employment.id)}
                label={employment.name}
                onClick={() => onEmploymentsChange(employmentIds.includes(employment.id)
                  ? employmentIds.filter((id) => id !== employment.id)
                  : [...employmentIds, employment.id])}
              />
            ))}
          </div>
        </div>
      ) : null}

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
          <div>
            <p className="mb-2 text-xs font-medium text-white/60">{t("statistics.filters.workType")}</p>
            <button type="button" onClick={() => onChange(updateStatisticsWorkTypes(filters, []))} className="mb-2 text-xs font-semibold text-white/45">{activeWorkTypeLabel}</button>
            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
              {workTypes
                .filter((workType) => employmentIds.length === 0 || (workType.employmentId && employmentIds.includes(workType.employmentId)))
                .map((workType) => (
                  <FilterChip key={workType.id} active={filters.workTypeIds.includes(workType.id)} label={workType.name} onClick={() => onChange(updateStatisticsWorkTypes(filters, filters.workTypeIds.includes(workType.id) ? filters.workTypeIds.filter((id) => id !== workType.id) : [...filters.workTypeIds, workType.id]))} />
                ))}
            </div>
          </div>
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
        <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.025] p-2.5">
          <div className="grid gap-1.5">
            <label className="flex min-h-11 items-center justify-between gap-3 rounded-[13px] bg-black/15 px-3 text-xs font-semibold text-white/55">
              <span>{t("statistics.customRange.from")}</span>
              <input
                type="date"
                value={draftFrom}
                onChange={(event) => setDraftFrom(event.target.value)}
                className="h-9 w-[9.75rem] max-w-[65%] rounded-[10px] border border-white/[0.08] bg-black/20 px-2 text-right text-[0.78rem] font-medium text-white [color-scheme:dark] outline-none transition focus:border-white/25 focus:bg-white/[0.04]"
              />
            </label>
            <label className="flex min-h-11 items-center justify-between gap-3 rounded-[13px] bg-black/15 px-3 text-xs font-semibold text-white/55">
              <span>{t("statistics.customRange.to")}</span>
              <input
                type="date"
                value={draftTo}
                onChange={(event) => setDraftTo(event.target.value)}
                className="h-9 w-[9.75rem] max-w-[65%] rounded-[10px] border border-white/[0.08] bg-black/20 px-2 text-right text-[0.78rem] font-medium text-white [color-scheme:dark] outline-none transition focus:border-white/25 focus:bg-white/[0.04]"
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

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${active ? "border-[#10b981]/45 bg-[#10b981]/14 text-[#6ee7b7]" : "border-white/[0.08] bg-white/[0.035] text-white/55"}`}>
      {active ? <Check className="h-3.5 w-3.5" /> : null}{label}
    </button>
  );
}

function parseDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function periodRange(period: StatisticsPeriod, anchor: Date) {
  if (period === "week") {
    const day = anchor.getDay() || 7;
    const from = addDays(anchor, 1 - day);
    return { from: formatStatisticsDate(from), to: formatStatisticsDate(addDays(from, 6)) };
  }
  if (period === "month") {
    const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { from: formatStatisticsDate(from), to: formatStatisticsDate(to) };
  }
  const year = anchor.getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function shiftedRange(filters: StatisticsFilters, direction: -1 | 1) {
  const anchor = parseDate(filters.from);
  if (filters.period === "week") anchor.setDate(anchor.getDate() + direction * 7);
  if (filters.period === "month") anchor.setMonth(anchor.getMonth() + direction);
  if (filters.period === "year") anchor.setFullYear(anchor.getFullYear() + direction);
  return { ...filters, ...periodRange(filters.period, anchor) };
}

function periodOptions(period: StatisticsPeriod, locale: string) {
  const now = new Date();
  if (period === "week") {
    return Array.from({ length: 104 }, (_, index) => {
      const range = periodRange(period, addDays(now, -index * 7));
      const from = parseDate(range.from);
      const to = parseDate(range.to);
      const format = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
      return { value: range.from, label: `${format.format(from)} – ${format.format(to)}`, range };
    });
  }
  if (period === "month") {
    return Array.from({ length: 60 }, (_, index) => {
      const anchor = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const range = periodRange(period, anchor);
      return {
        value: range.from.slice(0, 7),
        label: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(anchor),
        range
      };
    });
  }
  return Array.from({ length: 10 }, (_, index) => {
    const anchor = new Date(now.getFullYear() - index, 0, 1);
    const range = periodRange("year", anchor);
    return { value: String(anchor.getFullYear()), label: String(anchor.getFullYear()), range };
  });
}

function PeriodNavigator({ filters, onChange }: { filters: StatisticsFilters; onChange: (filters: StatisticsFilters) => void }) {
  const { t, i18n } = useTranslation("common");
  const touchStart = useRef<number | null>(null);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const options = periodOptions(filters.period, locale);
  const selectedDate = parseDate(filters.from);
  const value = filters.period === "week"
    ? filters.from
    : filters.period === "month"
      ? filters.from.slice(0, 7)
      : filters.from.slice(0, 4);
  const next = shiftedRange(filters, 1);
  const canMoveNext = next.from <= formatStatisticsDate(new Date());

  const move = (direction: -1 | 1) => {
    if (direction === 1 && !canMoveNext) return;
    onChange(shiftedRange(filters, direction));
  };

  return (
    <div
      className="flex touch-pan-y items-center gap-2 rounded-[18px] border border-white/[0.07] bg-white/[0.025] p-1.5"
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        if (touchStart.current === null) return;
        const distance = event.changedTouches[0]?.clientX - touchStart.current;
        touchStart.current = null;
        if (Math.abs(distance) < 45) return;
        move(distance > 0 ? -1 : 1);
      }}
    >
      <button
        type="button"
        onClick={() => move(-1)}
        aria-label={t("statistics.filters.previousPeriod")}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] text-white/55 transition active:bg-white/10 active:text-white"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      {filters.period === "month" || filters.period === "year" ? (
        <div className={`grid min-w-0 flex-1 gap-1.5 ${filters.period === "month" ? "grid-cols-2" : "grid-cols-1"}`}>
          {filters.period === "month" ? (
          <label className="min-w-0 text-[0.6rem] font-semibold uppercase tracking-[0.07em] text-white/35">
            {t("statistics.filters.month")}
            <select
              aria-label={t("statistics.filters.month")}
              value={selectedDate.getMonth()}
              onChange={(event) => onChange({
                ...filters,
                ...periodRange("month", new Date(selectedDate.getFullYear(), Number(event.target.value), 1))
              })}
              className="mt-0.5 h-9 w-full rounded-[10px] border border-white/[0.07] bg-white/[0.035] px-1.5 text-xs font-semibold capitalize text-white outline-none disabled:opacity-60"
            >
              {Array.from({ length: 12 }, (_, month) => (
                <option key={month} value={month} className="bg-neutral-900">
                  {new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2026, month, 1))}
                </option>
              ))}
            </select>
          </label>
          ) : null}
          <label className="min-w-0 text-[0.6rem] font-semibold uppercase tracking-[0.07em] text-white/35">
            {t("statistics.filters.year")}
            <select
              aria-label={t("statistics.filters.year")}
              value={selectedDate.getFullYear()}
              onChange={(event) => onChange({
                ...filters,
                ...periodRange(filters.period, new Date(Number(event.target.value), selectedDate.getMonth(), 1))
              })}
              className="mt-0.5 h-9 w-full rounded-[10px] border border-white/[0.07] bg-white/[0.035] px-1.5 text-xs font-semibold text-white outline-none"
            >
              {Array.from({ length: 10 }, (_, index) => new Date().getFullYear() - index).map((year) => (
                <option key={year} value={year} className="bg-neutral-900">{year}</option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t("statistics.filters.choosePeriod")}</span>
          <select
            value={value}
            aria-label={t("statistics.filters.choosePeriod")}
            onChange={(event) => {
              const option = options.find((item) => item.value === event.target.value);
              if (option) onChange({ ...filters, ...option.range });
            }}
            className="h-10 w-full appearance-none bg-transparent px-8 text-center text-base font-semibold capitalize text-white outline-none"
          >
            {options.map((option) => (
              <option key={option.value} value={option.value} className="bg-neutral-900 text-white">
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
        </label>
      )}
      <button
        type="button"
        disabled={!canMoveNext}
        onClick={() => move(1)}
        aria-label={t("statistics.filters.nextPeriod")}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] text-white/55 transition active:bg-white/10 active:text-white disabled:opacity-20"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
