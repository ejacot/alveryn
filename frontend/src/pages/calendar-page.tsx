import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  getCalendarActivityRange,
  getPreferences,
  getScheduledShifts,
  getWeeklySchedule,
  listAbsenceTypes,
  listAbsencesInRange,
  listEmployments,
  listHourlyRates,
  listRestDays,
  listWorkRecordsInRange,
  markRestDay,
  removeRestDay
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
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
import type { EmploymentRestDay } from "../types/rest-day";
import { parseLocalIsoDate } from "../utils/date";
import { formatCurrency, formatMinutesAsDuration } from "../utils/format";
import { calculatePaidAbsenceDays } from "../utils/paid-absence";
import { useEmploymentScope } from "../features/employment/employment-scope";

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
  const selectedEmploymentId = useEmploymentScope();
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
  const employmentsQuery = useQuery({
    queryKey: queryKeys.employments.all(),
    queryFn: listEmployments
  });
  const activeEmployments = (employmentsQuery.data ?? []).filter((employment) => employment.active);
  const effectiveEmploymentId =
    selectedEmploymentId ?? (activeEmployments.length === 1 ? activeEmployments[0].id : null);

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
  const restDaysQuery = useQuery({
    queryKey: queryKeys.restDays.range(effectiveEmploymentId ?? "none", monthStartKey, monthEndKey),
    queryFn: () => listRestDays(effectiveEmploymentId!, monthStartKey, monthEndKey),
    enabled: Boolean(effectiveEmploymentId)
  });
  const scheduleQuery = useQuery({
    queryKey: queryKeys.schedules.employment(effectiveEmploymentId ?? "none"),
    queryFn: () => getWeeklySchedule(effectiveEmploymentId!),
    enabled: Boolean(effectiveEmploymentId)
  });
  const scheduledShiftsQuery = useQuery({
    queryKey: queryKeys.schedules.shifts(
      effectiveEmploymentId ?? "none",
      monthStartKey,
      monthEndKey
    ),
    queryFn: () => getScheduledShifts(effectiveEmploymentId!, monthStartKey, monthEndKey),
    enabled: Boolean(effectiveEmploymentId && scheduleQuery.data)
  });
  const markRestDayMutation = useMutation({
    mutationFn: (date: string) => markRestDay(effectiveEmploymentId!, date),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.restDays.range(
          effectiveEmploymentId ?? "none",
          monthStartKey,
          monthEndKey
        )
      });
    }
  });
  const removeRestDayMutation = useMutation({
    mutationFn: (date: string) => removeRestDay(effectiveEmploymentId!, date),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.restDays.range(
          effectiveEmploymentId ?? "none",
          monthStartKey,
          monthEndKey
        )
      });
    }
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
    employmentsQuery.isLoading ||
    workRecordsQuery.isLoading ||
    previousWorkRecordsQuery.isLoading ||
    absencesQuery.isLoading ||
    absenceTypesQuery.isLoading ||
    previousAbsencesQuery.isLoading ||
    preferencesQuery.isLoading ||
    hourlyRatesQuery.isLoading;
  const classificationLoading = Boolean(effectiveEmploymentId) && (
    restDaysQuery.isLoading ||
    scheduleQuery.isLoading ||
    (Boolean(scheduleQuery.data) && scheduledShiftsQuery.isLoading)
  );
  const error =
    employmentsQuery.error ??
    workRecordsQuery.error ??
    previousWorkRecordsQuery.error ??
    absencesQuery.error ??
    absenceTypesQuery.error ??
    previousAbsencesQuery.error ??
    preferencesQuery.error ??
    hourlyRatesQuery.error;
  const classificationError =
    restDaysQuery.error ?? scheduleQuery.error ?? scheduledShiftsQuery.error;
  const records = useMemo(
    () => (workRecordsQuery.data ?? EMPTY_WORK_RECORDS).filter((record) => matchesEmployment(record.employmentId, effectiveEmploymentId)),
    [effectiveEmploymentId, workRecordsQuery.data]
  );
  const absences = useMemo(
    () => (absencesQuery.data ?? EMPTY_ABSENCES).filter((absence) => matchesEmployment(absence.employmentId, effectiveEmploymentId)),
    [absencesQuery.data, effectiveEmploymentId]
  );
  const absenceTypes = absenceTypesQuery.data ?? EMPTY_ABSENCE_TYPES;
  const absenceTypeById = useMemo(
    () => new Map(absenceTypes.map((type) => [type.id, type])),
    [absenceTypes]
  );
  const previousRecords = useMemo(
    () => (previousWorkRecordsQuery.data ?? EMPTY_WORK_RECORDS).filter((record) => matchesEmployment(record.employmentId, effectiveEmploymentId)),
    [effectiveEmploymentId, previousWorkRecordsQuery.data]
  );
  const previousAbsences = useMemo(
    () => (previousAbsencesQuery.data ?? EMPTY_ABSENCES).filter((absence) => matchesEmployment(absence.employmentId, effectiveEmploymentId)),
    [effectiveEmploymentId, previousAbsencesQuery.data]
  );
  const preferences = preferencesQuery.data ?? null;
  const hourlyRates = useMemo(
    () => (hourlyRatesQuery.data ?? []).filter((rate) => matchesEmployment(rate.employmentId, effectiveEmploymentId)),
    [effectiveEmploymentId, hourlyRatesQuery.data]
  );
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

  const manualRestDayByDate = useMemo(
    () => new Map((restDaysQuery.data ?? []).map((restDay) => [restDay.date, restDay])),
    [restDaysQuery.data]
  );
  const scheduledDates = useMemo(
    () => new Set((scheduledShiftsQuery.data ?? []).map((shift) => shift.startsAt.slice(0, 10))),
    [scheduledShiftsQuery.data]
  );
  const automaticRestDates = useMemo(() => {
    const schedule = scheduleQuery.data;
    if (!schedule) return new Set<string>();

    return new Set(
      monthGrid
        .filter((day) => {
          if (!day.inActiveMonth || day.key > todayIso) return false;
          if (day.key < schedule.validFrom || (schedule.validTo && day.key > schedule.validTo)) {
            return false;
          }
          return (
            !scheduledDates.has(day.key) &&
            !recordsByDate.has(day.key) &&
            !absenceByDate.has(day.key)
          );
        })
        .map((day) => day.key)
    );
  }, [absenceByDate, monthGrid, recordsByDate, scheduleQuery.data, scheduledDates, todayIso]);
  const restDates = useMemo(
    () => new Set([...manualRestDayByDate.keys(), ...automaticRestDates]),
    [automaticRestDates, manualRestDayByDate]
  );
  const missingDates = useMemo(() => {
    if (!scheduleQuery.data) return new Set<string>();
    return new Set(
      [...scheduledDates].filter(
        (date) =>
          date <= todayIso &&
          date >= monthStartKey &&
          date <= monthEndKey &&
          !recordsByDate.has(date) &&
          !absenceByDate.has(date) &&
          !restDates.has(date)
      )
    );
  }, [
    absenceByDate,
    monthEndKey,
    monthStartKey,
    recordsByDate,
    restDates,
    scheduleQuery.data,
    scheduledDates,
    todayIso
  ]);

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
  const selectedDateKey = selectedDate ? toIsoDate(selectedDate) : null;
  const selectedManualRestDay: EmploymentRestDay | null = selectedDateKey
    ? manualRestDayByDate.get(selectedDateKey) ?? null
    : null;
  const selectedAutomaticRestDay = Boolean(
    selectedDateKey && automaticRestDates.has(selectedDateKey)
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
    const workedDateKeys = new Set(
      monthlyMetricDays
        .filter((day) => day.minutes > 0 || day.amount > 0)
        .map((day) => day.key)
    );
    const absenceDateKeys = new Set(
      monthGrid
        .filter((day) =>
          day.inActiveMonth &&
          absenceByDate.has(day.key) &&
          !workedDateKeys.has(day.key)
        )
        .map((day) => day.key)
    );
    const absenceDays = absenceDateKeys.size;
    const workedDays = workedDateKeys.size;
    const classifiableDates = monthGrid
      .filter((day) => day.inActiveMonth && day.key <= todayIso)
      .map((day) => day.key);
    const classifiedDates = new Set(
      classifiableDates.filter(
        (date) =>
          recordsByDate.has(date) ||
          absenceByDate.has(date) ||
          restDates.has(date)
      )
    );
    const currencies = new Set([
      ...records.map((record) => record.currency).filter(Boolean)
    ]);
    const currency = records[0]?.currency ?? paidAbsences[0]?.currency ?? "EUR";
    const paidAbsenceCurrencies = new Set(
      paidAbsences.map((absence) => absence.currency)
    );
    const totalCurrencies = new Set([...currencies, ...paidAbsenceCurrencies]);

    return {
      workedHours: formatMinutesAsDuration(workedMinutes),
      paidAbsenceHours: formatMinutesAsDuration(paidAbsenceMinutes),
      extraPaidHours: formatMinutesAsDuration(extraPaid.minutes),
      workGrossAmount: totalCurrencies.size > 1
        ? t("monthlySummary.mixedCurrencies")
        : formatCurrency(String(workGrossAmount + paidAbsenceGrossAmount), currency),
      paidAbsenceGrossAmount: paidAbsenceCurrencies.size > 1
        ? t("monthlySummary.mixedCurrencies")
        : formatCurrency(String(paidAbsenceGrossAmount), paidAbsences[0]?.currency ?? currency),
      extraPaidGrossAmount: currencies.size > 1
        ? t("monthlySummary.mixedCurrencies")
        : formatCurrency(String(extraPaid.grossAmount), currency),
      hasWorkedTime: workedMinutes > 0,
      workedDays,
      absenceDays,
      restDays: classifiableDates.filter((date) => restDates.has(date)).length,
      missingDays: classifiableDates.filter((date) => missingDates.has(date)).length,
      classifiedDays: classifiedDates.size,
      totalDays: classifiableDates.length
    };
  }, [
    absenceByDate,
    absences,
    hourlyRates,
    missingDates,
    monthEndKey,
    monthGrid,
    monthlyMetricDays,
    monthStartKey,
    preferences,
    records,
    recordsByDate,
    restDates,
    t,
    todayIso
  ]);

  function changeMonth(direction: -1 | 1) {
    const nextMonth = direction === -1 ? getPreviousMonthDate(activeMonth) : getNextMonthDate(activeMonth);
    setSlideDirection(direction);
    setActiveMonth(nextMonth);
    setSelectedDate(null);
  }

  if (isLoading || classificationLoading) {
    return <CalendarSkeleton />;
  }

  if (error || classificationError) {
    return (
      <CalendarErrorState
        message={getApiError(error ?? classificationError).message}
        onRetry={() => {
          void workRecordsQuery.refetch();
          void employmentsQuery.refetch();
          void previousWorkRecordsQuery.refetch();
          void absencesQuery.refetch();
          void previousAbsencesQuery.refetch();
          void preferencesQuery.refetch();
          void hourlyRatesQuery.refetch();
          void restDaysQuery.refetch();
          void scheduleQuery.refetch();
          void scheduledShiftsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-6 pb-28 pt-8">
      <header className="settings-sticky-header dashboard-sticky-header calendar-sticky-header pointer-events-none fixed inset-x-0 top-0 z-40 mx-auto w-full max-w-[560px]">
        <div
          className={`settings-sticky-header-title absolute left-1/2 flex h-9 -translate-x-1/2 items-center text-[1rem] font-bold leading-none tracking-[-0.035em] text-white transition duration-300 ${
            compactTitleVisible ? "translate-y-0 opacity-100 delay-100" : "translate-y-1 opacity-0"
          }`}
          aria-hidden="true"
        >
          {t("title")}
        </div>
      </header>

      <h1
        ref={largeTitleRef}
        className={`text-[2.25rem] font-semibold leading-none tracking-[-0.06em] text-white transition duration-200 ${
          compactTitleVisible ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100 delay-75"
        }`}
      >
        {t("title")}
      </h1>

      <section className="space-y-4">
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
            const marker = absence
              ? {
                  label: configuredType?.name || absence.absenceTypeName,
                  color: configuredType?.color || defaultAbsenceColor(absence.absenceType)
                }
              : restDates.has(isoDate)
                ? { label: t("restDay.title"), color: "rgba(255,255,255,0.34)" }
                : null;
            return {
              entriesCount: recordsCount,
              marker,
              noActivityInTrackedRange:
                missingDates.has(isoDate) ||
                (inTrackedRange && recordsCount === 0 && !marker && !scheduleQuery.data)
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
            restDay={Boolean(
              selectedDateKey &&
              (selectedManualRestDay || selectedAutomaticRestDay)
            )}
            automaticRestDay={selectedAutomaticRestDay && !selectedManualRestDay}
            restDayPending={
              markRestDayMutation.isPending || removeRestDayMutation.isPending
            }
            onMarkRestDay={
              effectiveEmploymentId && !selectedRecords.length && !selectedAbsence && selectedDateKey
                ? () => markRestDayMutation.mutate(selectedDateKey)
                : undefined
            }
            onRemoveRestDay={
              selectedManualRestDay && selectedDateKey
                ? () => removeRestDayMutation.mutate(selectedDateKey)
                : undefined
            }
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

function matchesEmployment(value: string | null | undefined, selectedEmploymentId: string | null) {
  return !selectedEmploymentId || value === selectedEmploymentId;
}
