import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getCalendarActivityRange,
  getPreferences,
  listAbsenceTypes,
  listAbsencesInRange,
  listHourlyRates,
  listWorkRecordsInRange
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { Button } from "../components/ui/button";
import { CalendarErrorState } from "../components/calendar/calendar-error-state";
import { CalendarMonthGrid } from "../components/calendar/calendar-month-grid";
import { CalendarMonthSummary } from "../components/calendar/calendar-month-summary";
import {
  CalendarMonthlyMetricCard,
  type CalendarMonthlyMetricDay
} from "../components/calendar/calendar-monthly-metric-card";
import { CalendarSelectedDayPanel } from "../components/calendar/calendar-selected-day-panel";
import { CalendarSkeleton } from "../components/calendar/calendar-skeleton";
import {
  addDays,
  absenceOverlapsDate,
  buildMonthGrid,
  countMonthOverlapDays,
  formatMonthLabel,
  formatSelectedDate,
  getNextMonthDate,
  getPreviousMonthDate,
  isSameMonth,
  resolveMonthSwipeDirection,
  startOfMonth,
  toIsoDate
} from "../features/calendar/calendar-utils";
import type { Absence, AbsenceTypeSetting } from "../types/absence";
import type { WorkRecord } from "../types/work-record";
import { parseLocalIsoDate } from "../utils/date";
import { formatCurrency, formatMinutesAsDuration } from "../utils/format";
import { calculatePaidAbsenceDays } from "../utils/paid-absence";

const EMPTY_ABSENCES: Absence[] = [];
const EMPTY_WORK_RECORDS: WorkRecord[] = [];
const EMPTY_ABSENCE_TYPES: AbsenceTypeSetting[] = [];

type OutletContext = {
  setSelectedDate?: (date: Date) => void;
};

export function CalendarPage() {
  const navigate = useNavigate();
  const outletContext = useOutletContext<OutletContext>();
  const { t } = useTranslation("calendar");
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date(), []);
  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slideDirection, setSlideDirection] = useState(0);
  const [compactTitleVisible, setCompactTitleVisible] = useState(false);
  const largeTitleRef = useRef<HTMLHeadingElement>(null);

  const year = activeMonth.getFullYear();
  const month = activeMonth.getMonth() + 1;
  const monthStartKey = toIsoDate(startOfMonth(activeMonth));
  const monthEndKey = toIsoDate(addDays(getNextMonthDate(activeMonth), -1));

  const workRecordsQuery = useQuery({
    queryKey: queryKeys.workRecords.range({ from: monthStartKey, to: monthEndKey }),
    queryFn: () => listWorkRecordsInRange({ from: monthStartKey, to: monthEndKey })
  });
  const previousMonth = getPreviousMonthDate(activeMonth);
  const previousMonthStartKey = toIsoDate(startOfMonth(previousMonth));
  const previousMonthEndKey = toIsoDate(addDays(getNextMonthDate(previousMonth), -1));
  const previousWorkRecordsQuery = useQuery({
    queryKey: queryKeys.workRecords.range({ from: previousMonthStartKey, to: previousMonthEndKey }),
    queryFn: () => listWorkRecordsInRange({ from: previousMonthStartKey, to: previousMonthEndKey })
  });

  const absencesQuery = useQuery({
    queryKey: queryKeys.absences.range({ year, month }),
    queryFn: () => listAbsencesInRange({ year, month })
  });
  const absenceTypesQuery = useQuery({
    queryKey: queryKeys.absenceTypes.list(false),
    queryFn: () => listAbsenceTypes(false)
  });
  const previousAbsencesQuery = useQuery({
    queryKey: queryKeys.absences.range({
      year: previousMonth.getFullYear(),
      month: previousMonth.getMonth() + 1
    }),
    queryFn: () => listAbsencesInRange({
      year: previousMonth.getFullYear(),
      month: previousMonth.getMonth() + 1
    })
  });

  const activityRangeQuery = useQuery({
    queryKey: queryKeys.calendar.activityRange(),
    queryFn: getCalendarActivityRange
  });
  const preferencesQuery = useQuery({
    queryKey: queryKeys.preferences(),
    queryFn: getPreferences
  });
  const hourlyRatesQuery = useQuery({
    queryKey: queryKeys.hourlyRates.all(),
    queryFn: listHourlyRates
  });
  useEffect(() => {
    const previousMonth = getPreviousMonthDate(activeMonth);
    const nextMonth = getNextMonthDate(activeMonth);
    const previousMonthStartKey = toIsoDate(startOfMonth(previousMonth));
    const previousMonthEndKey = toIsoDate(addDays(getNextMonthDate(previousMonth), -1));
    const nextMonthStartKey = toIsoDate(startOfMonth(nextMonth));
    const nextMonthEndKey = toIsoDate(addDays(getNextMonthDate(nextMonth), -1));

    void queryClient.prefetchQuery({
      queryKey: queryKeys.workRecords.range({ from: previousMonthStartKey, to: previousMonthEndKey }),
      queryFn: () => listWorkRecordsInRange({ from: previousMonthStartKey, to: previousMonthEndKey })
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.workRecords.range({ from: nextMonthStartKey, to: nextMonthEndKey }),
      queryFn: () => listWorkRecordsInRange({ from: nextMonthStartKey, to: nextMonthEndKey })
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.absences.range({
        year: previousMonth.getFullYear(),
        month: previousMonth.getMonth() + 1
      }),
      queryFn: () =>
        listAbsencesInRange({
          year: previousMonth.getFullYear(),
          month: previousMonth.getMonth() + 1
        })
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.absences.range({
        year: nextMonth.getFullYear(),
        month: nextMonth.getMonth() + 1
      }),
      queryFn: () =>
        listAbsencesInRange({
          year: nextMonth.getFullYear(),
          month: nextMonth.getMonth() + 1
        })
    });
  }, [activeMonth, queryClient]);

  useEffect(() => {
    let frameId = 0;

    const updateCompactTitle = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const titleRect = largeTitleRef.current?.getBoundingClientRect();
        setCompactTitleVisible(Boolean(titleRect && titleRect.top <= 60));
      });
    };

    updateCompactTitle();
    window.addEventListener("scroll", updateCompactTitle, { passive: true });
    window.addEventListener("resize", updateCompactTitle);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateCompactTitle);
      window.removeEventListener("resize", updateCompactTitle);
    };
  }, []);

  const isLoading =
    workRecordsQuery.isLoading ||
    previousWorkRecordsQuery.isLoading ||
    absencesQuery.isLoading ||
    absenceTypesQuery.isLoading ||
    previousAbsencesQuery.isLoading ||
    preferencesQuery.isLoading ||
    hourlyRatesQuery.isLoading;
  const error =
    workRecordsQuery.error ??
    previousWorkRecordsQuery.error ??
    absencesQuery.error ??
    absenceTypesQuery.error ??
    previousAbsencesQuery.error ??
    preferencesQuery.error ??
    hourlyRatesQuery.error;
  const records = workRecordsQuery.data ?? EMPTY_WORK_RECORDS;
  const absences = absencesQuery.data ?? EMPTY_ABSENCES;
  const absenceTypes = absenceTypesQuery.data ?? EMPTY_ABSENCE_TYPES;
  const absenceTypeById = useMemo(
    () => new Map(absenceTypes.map((type) => [type.id, type])),
    [absenceTypes]
  );
  const previousRecords = previousWorkRecordsQuery.data ?? EMPTY_WORK_RECORDS;
  const previousAbsences = previousAbsencesQuery.data ?? EMPTY_ABSENCES;
  const preferences = preferencesQuery.data ?? null;
  const hourlyRates = useMemo(() => hourlyRatesQuery.data ?? [], [hourlyRatesQuery.data]);
  const firstActivityDate = activityRangeQuery.data?.firstActivityDate ?? null;
  const todayIso = toIsoDate(today);

  const monthlyMetricDays = useMemo(
    () => buildMonthlyMetricDays(activeMonth, records, absences, absenceTypeById, selectedDate, today),
    [absenceTypeById, absences, activeMonth, records, selectedDate, today]
  );
  const previousMonthlyMetricDays = useMemo(
    () => buildMonthlyMetricDays(previousMonth, previousRecords, previousAbsences, absenceTypeById, null, today),
    [absenceTypeById, previousAbsences, previousMonth, previousRecords, today]
  );

  const monthGrid = useMemo(() => buildMonthGrid(activeMonth), [activeMonth]);

  const recordsByDate = useMemo(() => {
    const grouped = new Map<string, WorkRecord[]>();
    records.forEach((record) => {
      const bucket = grouped.get(record.workDate) ?? [];
      bucket.push(record);
      grouped.set(record.workDate, bucket);
    });
    return grouped;
  }, [records]);

  const absenceByDate = useMemo(() => {
    const grouped = new Map<string, Absence>();
    monthGrid.forEach((day) => {
      const found = absences.find((absence) => absenceOverlapsDate(absence, day.date));
      if (found) {
        grouped.set(day.key, found);
      }
    });
    return grouped;
  }, [absences, monthGrid]);

  useEffect(() => {
    if (selectedDate !== null && !isSameMonth(selectedDate, activeMonth)) {
      setSelectedDate(null);
    }
  }, [activeMonth, selectedDate]);

  const selectedRecords = selectedDate ? recordsByDate.get(toIsoDate(selectedDate)) ?? EMPTY_WORK_RECORDS : EMPTY_WORK_RECORDS;

  const selectedAbsence = useMemo(
    () => (selectedDate ? absenceByDate.get(toIsoDate(selectedDate)) ?? null : null),
    [absenceByDate, selectedDate]
  );

  const selectedPaidAbsenceMinutes = useMemo(() => {
    if (!selectedDate || !selectedAbsence) {
      return 0;
    }

    const selectedDateKey = toIsoDate(selectedDate);
    return calculatePaidAbsenceDays({
      absences: [selectedAbsence],
      activityDates: selectedRecords.map((record) => record.workDate),
      hourlyRates,
      preferences,
      from: selectedDateKey,
      to: selectedDateKey
    }).reduce((total, absence) => total + absence.minutes, 0);
  }, [hourlyRates, preferences, selectedAbsence, selectedDate, selectedRecords]);

  const summary = useMemo(() => {
    const paidAbsences = calculatePaidAbsenceDays({
      absences,
      activityDates: records.map((record) => record.workDate),
      hourlyRates,
      preferences,
      from: monthStartKey,
      to: monthEndKey
    });
    const workedMinutes = monthlyMetricDays.reduce((total, day) => total + day.minutes, 0);
    const workGrossAmount = monthlyMetricDays.reduce((total, day) => total + day.amount, 0);
    const paidAbsenceMinutes = paidAbsences.reduce((total, absence) => total + absence.minutes, 0);
    const paidAbsenceGrossAmount = paidAbsences.reduce((total, absence) => total + absence.grossAmount, 0);
    const extraPaid = calculateExtraPaidInRange(records, absences, monthStartKey, monthEndKey);
    const absenceDays = absences.reduce(
      (total, absence) => total + countMonthOverlapDays(absence, activeMonth),
      0
    );
    const workedDays = monthlyMetricDays.filter((day) => day.minutes > 0 || day.amount > 0).length;
    const currencies = new Set([
      ...records.map((record) => record.currency).filter(Boolean)
    ]);
    const currency = records[0]?.currency ?? paidAbsences[0]?.currency ?? "EUR";
    const paidAbsenceCurrencies = new Set([
      ...paidAbsences.map((absence) => absence.currency),
      ...records.filter((record) => record.workLines?.some((line) => line.extraPayPercentage > 0))
        .map((record) => record.currency)
        .filter((value): value is string => Boolean(value))
    ]);
    const totalCurrencies = new Set([...currencies, ...paidAbsenceCurrencies]);

    return {
      workedHours: formatMinutesAsDuration(workedMinutes),
      paidAbsenceHours: formatMinutesAsDuration(paidAbsenceMinutes + extraPaid.minutes),
      workGrossAmount: totalCurrencies.size > 1
        ? t("monthlySummary.mixedCurrencies")
        : formatCurrency(String(workGrossAmount + paidAbsenceGrossAmount), currency),
      paidAbsenceGrossAmount: paidAbsenceCurrencies.size > 1
        ? t("monthlySummary.mixedCurrencies")
        : formatCurrency(String(paidAbsenceGrossAmount + extraPaid.grossAmount), paidAbsences[0]?.currency ?? currency),
      hasWorkedTime: workedMinutes > 0,
      workedDays,
      absenceDays
    };
  }, [absences, activeMonth, hourlyRates, monthEndKey, monthlyMetricDays, monthStartKey, preferences, records, t]);

  function changeMonth(direction: -1 | 1) {
    const nextMonth = direction === -1 ? getPreviousMonthDate(activeMonth) : getNextMonthDate(activeMonth);
    setSlideDirection(direction);
    setActiveMonth(nextMonth);
    setSelectedDate(null);
  }

  if (isLoading) {
    return <CalendarSkeleton />;
  }

  if (error) {
    return (
      <CalendarErrorState
        message={getApiError(error).message}
        onRetry={() => {
          void workRecordsQuery.refetch();
          void previousWorkRecordsQuery.refetch();
          void absencesQuery.refetch();
          void previousAbsencesQuery.refetch();
          void preferencesQuery.refetch();
          void hourlyRatesQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-8 pb-28 pt-12">
      <header className="settings-sticky-header pointer-events-none fixed inset-x-0 top-0 z-40 mx-auto h-[7.25rem] w-full max-w-[560px]">
        <div
          className={`absolute left-1/2 top-[3.75rem] flex h-10 -translate-x-1/2 items-center text-[1.08rem] font-bold leading-none tracking-[-0.045em] text-white transition duration-300 ${
            compactTitleVisible ? "translate-y-0 opacity-100 delay-100" : "translate-y-1 opacity-0"
          }`}
          aria-hidden="true"
        >
          {t("title")}
        </div>
      </header>

      <h1
        ref={largeTitleRef}
        className={`text-[2.8rem] font-semibold leading-none tracking-[-0.08em] text-white transition duration-200 ${
          compactTitleVisible ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100 delay-75"
        }`}
      >
        {t("title")}
      </h1>

      <section className="space-y-4">
        <div className="hidden items-center justify-end gap-2 md:flex">
          <Button
            variant="ghost"
            className="h-10 min-h-10 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 text-white/50 hover:bg-white/[0.035]"
            onClick={() => changeMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="h-10 min-h-10 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 text-white/50 hover:bg-white/[0.035]"
            onClick={() => changeMonth(1)}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <CalendarMonthGrid
          monthLabel={formatMonthLabel(activeMonth)}
          monthKey={`${year}-${month}`}
          slideDirection={slideDirection}
          days={monthGrid}
          selectedDate={selectedDate}
          today={today}
          absenceTypes={absenceTypes.filter((type) => type.active)}
          getDayMeta={(isoDate) => {
            const recordsCount = recordsByDate.get(isoDate)?.length ?? 0;
            const inTrackedRange = isInTrackedRange(isoDate, firstActivityDate, todayIso);
            const absence = absenceByDate.get(isoDate) ?? null;
            const configuredType = absence?.absenceTypeId
              ? absenceTypeById.get(absence.absenceTypeId)
              : null;
            const marker = absence ? {
              label: configuredType?.name || absence.absenceTypeName,
              color: configuredType?.color || defaultAbsenceColor(absence.absenceType)
            } : null;
            return {
              entriesCount: recordsCount,
              marker,
              noActivityInTrackedRange: inTrackedRange && recordsCount === 0 && !marker
            };
          }}
          onSelect={(date) => {
            setSelectedDate(date);
            outletContext?.setSelectedDate?.(date);
            if (!isSameMonth(date, activeMonth)) {
              setActiveMonth(startOfMonth(date));
            }
          }}
          onSwipeChange={changeMonth}
          onResolveSwipe={resolveMonthSwipeDirection}
        />
      </section>

      <CalendarMonthSummary {...summary} />

      {selectedDate ? (
        <div className="pt-5">
          <CalendarSelectedDayPanel
            title={formatSelectedDate(selectedDate)}
            records={selectedRecords}
            absence={selectedAbsence}
            absenceColor={selectedAbsence?.absenceTypeId
              ? absenceTypeById.get(selectedAbsence.absenceTypeId)?.color
              : undefined}
            paidAbsenceMinutes={selectedPaidAbsenceMinutes}
            onEntrySelect={(entryId) =>
              navigate(`/records/${entryId.slice("record:".length)}`, {
                state: { returnTo: "/calendar" }
              })
            }
          />
        </div>
      ) : null}

      <CalendarMonthlyMetricCard
        variant="flow"
        days={monthlyMetricDays}
        previousMonthTotal={previousMonthlyMetricDays.reduce((total, day) => total + day.amount, 0)}
        currency={records[0]?.currency ?? preferences?.currency ?? "EUR"}
        onDaySelect={(date) => {
          const parsed = parseLocalIsoDate(date);
          setSelectedDate(parsed);
          outletContext?.setSelectedDate?.(parsed);
        }}
      />

      <CalendarMonthlyMetricCard
        variant="rhythm"
        days={monthlyMetricDays}
        previousMonthTotal={previousMonthlyMetricDays.reduce((total, day) => total + day.minutes, 0)}
        onDaySelect={(date) => {
          const parsed = parseLocalIsoDate(date);
          setSelectedDate(parsed);
          outletContext?.setSelectedDate?.(parsed);
        }}
      />

    </div>
  );
}

function isInTrackedRange(isoDate: string, firstActivityDate: string | null, todayIso: string) {
  return Boolean(firstActivityDate && isoDate >= firstActivityDate && isoDate <= todayIso);
}

function buildMonthlyMetricDays(
  month: Date,
  records: WorkRecord[],
  absences: Absence[],
  absenceTypeById: Map<string, AbsenceTypeSetting>,
  selectedDate: Date | null,
  today: Date
): CalendarMonthlyMetricDay[] {
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(month.getFullYear(), month.getMonth(), index + 1, 12);
    const key = toIsoDate(date);
    const absence = absences.find((item) => absenceOverlapsDate(item, date)) ?? null;
    let minutes = 0;
    let amount = 0;

    if (!absence) {
      records.filter((record) => record.workDate <= key && (record.workEndDate ?? record.workDate) >= key)
        .forEach((record) => {
          const eligibleDays = recordEligibleDates(record, absences);
          if (!eligibleDays.includes(key) || eligibleDays.length === 0) return;
          minutes += recordTimeMinutes(record) / eligibleDays.length;
          amount += Number(record.grossAmount) / eligibleDays.length;
        });
    }

    return {
      key,
      dayNumber: index + 1,
      minutes,
      amount,
      absenceColor: absence
        ? (absence.absenceTypeId ? absenceTypeById.get(absence.absenceTypeId)?.color : null)
          || defaultAbsenceColor(absence.absenceType)
        : null,
      selected: selectedDate
        ? toIsoDate(selectedDate) === key
        : toIsoDate(today) === key
    };
  });
}

function recordEligibleDates(record: WorkRecord, absences: Absence[]) {
  const result: string[] = [];
  const end = record.workEndDate ?? record.workDate;
  for (let key = record.workDate; key <= end; key = toIsoDate(addDays(parseLocalIsoDate(key), 1))) {
    const date = parseLocalIsoDate(key);
    if (!absences.some((absence) => absenceOverlapsDate(absence, date))) result.push(key);
  }
  return result;
}

function calculateExtraPaidInRange(
  records: WorkRecord[],
  absences: Absence[],
  from: string,
  to: string
) {
  return records.reduce((total, record) => {
    const eligibleDays = recordEligibleDates(record, absences);
    if (eligibleDays.length === 0) return total;
    const overlapDays = eligibleDays.filter((date) => date >= from && date <= to).length;
    const allocation = overlapDays / eligibleDays.length;

    record.workLines?.forEach((line) => {
      const percentage = line.extraPayPercentage ?? 0;
      if (percentage <= 0) return;
      total.minutes += Number(line.calculatedMinutes) * (percentage / 100) * allocation;
      total.grossAmount += Number(line.grossAmount) * (percentage / (100 + percentage)) * allocation;
    });
    return total;
  }, { minutes: 0, grossAmount: 0 });
}

function recordTimeMinutes(record: WorkRecord) {
  return (record.workLines ?? [])
    .filter((line) => line.calculationMode === "TIME_HOURLY" || line.calculationMode === "UNITS_PER_HOUR")
    .reduce((total, line) => total + Number(line.calculatedMinutes), 0);
}

function defaultAbsenceColor(type: Absence["absenceType"]) {
  if (type === "SICK_LEAVE") return "#ef4444";
  if (type === "VACATION") return "#22c55e";
  return "#737373";
}
