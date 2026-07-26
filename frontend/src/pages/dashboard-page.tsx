import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  createAbsence,
  deleteAbsence,
  getAbsences,
  getPreferences,
  listAbsenceTypes,
  listEmployments,
  listHourlyRates,
  listRestDays,
  markRestDay,
  removeRestDay,
  listWorkRecordsInRange
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { i18n } from "../i18n";
import { DashboardErrorState } from "../components/dashboard/dashboard-error-state";
import { DashboardOverview } from "../components/dashboard/dashboard-overview";
import { DashboardSkeleton } from "../components/dashboard/dashboard-skeleton";
import { TimeTrackingCard } from "../components/dashboard/time-tracking-card";
import type { DashboardSummaryMetrics, SelectedDayActivity, WeeklyRhythmDay } from "../types/dashboard";
import type { Absence, AbsenceTypeSetting } from "../types/absence";
import type { WorkRecord, WorkRecordLine } from "../types/work-record";
import { addDays, addWeeks, formatLocalIsoDate, isSameDay, parseLocalIsoDate, safeLocalIsoDate, startOfWeek } from "../utils/date";
import {
  formatCurrency,
  formatMinutesAsDuration
} from "../utils/format";
import { calculatePaidAbsenceDays } from "../utils/paid-absence";
import { useEmploymentScope } from "../features/employment/employment-scope";

type OutletContext = {
  selectedDate?: Date;
  setSelectedDate?: (date: Date) => void;
};

type DashboardPageProps = {
  selectedDate?: Date;
};

export function DashboardPage({ selectedDate: selectedDateProp }: DashboardPageProps = {}) {
  const { t } = useTranslation(["dashboard", "common"]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectedEmploymentId = useEmploymentScope();
  const [absenceScopeError, setAbsenceScopeError] = useState<string | null>(null);
  const outletContext = useOutletContext<OutletContext>();
  const selectedDate = useMemo(
    () => selectedDateProp ?? outletContext?.selectedDate ?? new Date(),
    [outletContext?.selectedDate, selectedDateProp]
  );
  const selectedDateKey = safeLocalIsoDate(selectedDate);

  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );
  const weekStartKey = formatLocalIsoDate(weekDays[0]);
  const weekEndKey = formatLocalIsoDate(weekDays[6]);
  const previousWeekStartKey = shiftIsoDate(weekStartKey, -7);
  const previousWeekEndKey = shiftIsoDate(weekEndKey, -7);
  const previousWeekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftIsoDate(previousWeekStartKey, index)),
    [previousWeekStartKey]
  );

  const rhythmRecordsQuery = useQuery({
    queryKey: queryKeys.workRecords.range({ from: previousWeekStartKey, to: weekEndKey }),
    queryFn: () => listWorkRecordsInRange({ from: previousWeekStartKey, to: weekEndKey })
  });
  const preferencesQuery = useQuery({
    queryKey: queryKeys.preferences(),
    queryFn: getPreferences
  });
  const employmentsQuery = useQuery({
    queryKey: queryKeys.employments.all(),
    queryFn: listEmployments
  });
  const hourlyRatesQuery = useQuery({
    queryKey: queryKeys.hourlyRates.all(),
    queryFn: listHourlyRates
  });
  const absenceTypesQuery = useQuery({
    queryKey: queryKeys.absenceTypes.list(true),
    queryFn: () => listAbsenceTypes(true)
  });
  const weeklyAbsencesQuery = useQuery({
    queryKey: queryKeys.absences.list({ from: previousWeekStartKey, to: weekEndKey }),
    queryFn: () => getAbsences({ from: previousWeekStartKey, to: weekEndKey })
  });
  const activeEmployments = (employmentsQuery.data ?? []).filter((employment) => employment.active);
  const effectiveEmploymentId = selectedEmploymentId
    ?? (activeEmployments.length === 1 ? activeEmployments[0].id : null);
  const restDaysQuery = useQuery({
    queryKey: queryKeys.restDays.range(
      effectiveEmploymentId ?? "none",
      selectedDateKey,
      selectedDateKey
    ),
    queryFn: () => listRestDays(effectiveEmploymentId!, selectedDateKey, selectedDateKey),
    enabled: Boolean(effectiveEmploymentId)
  });
  const absenceMutation = useMutation({
    mutationFn: ({ absenceTypeId, date, employmentId }: { absenceTypeId: string; date: string; employmentId: string }) =>
      createAbsence({
        employmentId,
        absenceTypeId,
        startDate: date,
        endDate: date,
        notes: null
      }),
    onSuccess: async (_, variables) => {
      setAbsenceScopeError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.absences.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.calendar.activityRange() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
      ]);
      outletContext?.setSelectedDate?.(parseLocalIsoDate(variables.date));
    }
  });
  const deleteAbsenceMutation = useMutation({
    mutationFn: ({ id }: { id: string; date: string }) => deleteAbsence(id),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.absences.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.calendar.activityRange() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
      ]);
      outletContext?.setSelectedDate?.(parseLocalIsoDate(variables.date));
    }
  });
  const markRestDayMutation = useMutation({
    mutationFn: ({ employmentId, date }: { employmentId: string; date: string }) =>
      markRestDay(employmentId, date),
    onSuccess: async (_, variables) => {
      setAbsenceScopeError(null);
      await queryClient.invalidateQueries({ queryKey: ["rest-days", variables.employmentId] });
    }
  });
  const removeRestDayMutation = useMutation({
    mutationFn: ({ employmentId, date }: { employmentId: string; date: string }) =>
      removeRestDay(employmentId, date),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["rest-days", variables.employmentId] });
    }
  });

  const isLoading =
    rhythmRecordsQuery.isLoading ||
    preferencesQuery.isLoading ||
    employmentsQuery.isLoading ||
    hourlyRatesQuery.isLoading ||
    absenceTypesQuery.isLoading ||
    weeklyAbsencesQuery.isLoading ||
    (Boolean(effectiveEmploymentId) && restDaysQuery.isLoading);
  const errorQuery =
    (rhythmRecordsQuery.error ? rhythmRecordsQuery : null) ??
    (preferencesQuery.error ? preferencesQuery : null) ??
    (employmentsQuery.error ? employmentsQuery : null) ??
    (hourlyRatesQuery.error ? hourlyRatesQuery : null) ??
    (absenceTypesQuery.error ? absenceTypesQuery : null) ??
    (weeklyAbsencesQuery.error ? weeklyAbsencesQuery : null) ??
    (restDaysQuery.error ? restDaysQuery : null);

  const rhythmRecords = useMemo(
    () => (rhythmRecordsQuery.data ?? []).filter((record) => matchesEmployment(record.employmentId, selectedEmploymentId)),
    [rhythmRecordsQuery.data, selectedEmploymentId]
  );
  const weeklyRecords = useMemo(
    () => rhythmRecords.filter((record) => recordOverlapsRange(record, weekStartKey, weekEndKey)),
    [rhythmRecords, weekEndKey, weekStartKey]
  );
  const previousWeeklyRecords = useMemo(
    () => rhythmRecords.filter((record) => recordOverlapsRange(record, previousWeekStartKey, previousWeekEndKey)),
    [previousWeekEndKey, previousWeekStartKey, rhythmRecords]
  );
  const weeklyDailyRecords = useMemo(
    () => weeklyRecords.filter((record) => !isProjectTotalRecord(record)),
    [weeklyRecords]
  );
  const previousWeeklyDailyRecords = useMemo(
    () => previousWeeklyRecords.filter((record) => !isProjectTotalRecord(record)),
    [previousWeeklyRecords]
  );
  const selectedDayRecords = useMemo(
    () => weeklyRecords.filter((record) => recordCoversDate(record, selectedDateKey)),
    [selectedDateKey, weeklyRecords]
  );
  const selectedDaySummaryRecords = useMemo(
    () => selectedDayRecords.filter((record) => !isProjectTotalRecord(record)),
    [selectedDayRecords]
  );
  const preferences = preferencesQuery.data ?? null;
  const absenceEmploymentId = selectedEmploymentId
    ?? (activeEmployments.length === 1 ? activeEmployments[0].id : null);
  const selectedRestDay = (restDaysQuery.data ?? []).find(
    (restDay) => restDay.date === selectedDateKey
  ) ?? null;
  const hourlyRates = useMemo(
    () => (hourlyRatesQuery.data ?? []).filter((rate) => matchesEmployment(rate.employmentId, selectedEmploymentId)),
    [hourlyRatesQuery.data, selectedEmploymentId]
  );
  const rhythmAbsences = useMemo(
    () => (weeklyAbsencesQuery.data?.content ?? []).filter((absence) => matchesEmployment(absence.employmentId, selectedEmploymentId)),
    [selectedEmploymentId, weeklyAbsencesQuery.data]
  );
  const weeklyAbsences = useMemo(
    () => rhythmAbsences.filter((absence) => absenceOverlapsRange(absence, weekStartKey, weekEndKey)),
    [rhythmAbsences, weekEndKey, weekStartKey]
  );
  const previousWeeklyAbsences = useMemo(
    () => rhythmAbsences.filter((absence) => absenceOverlapsRange(absence, previousWeekStartKey, previousWeekEndKey)),
    [previousWeekEndKey, previousWeekStartKey, rhythmAbsences]
  );
  const selectedAbsence = useMemo(
    () => weeklyAbsences.find((absence) => absenceCoversDate(absence, selectedDate)) ?? null,
    [selectedDate, weeklyAbsences]
  );

  const selectedDayLabel = useMemo(
    () => formatSelectedDayLabel(selectedDate, t("dashboard:selectedDay.today")),
    [selectedDate, t]
  );
  const selectedDayPaidAbsences = useMemo(
    () =>
      calculatePaidAbsenceDays({
        absences: selectedAbsence ? [selectedAbsence] : [],
        activityDates: selectedDaySummaryRecords.map((record) => record.workDate),
        hourlyRates,
        preferences,
        from: selectedDateKey,
        to: selectedDateKey
      }),
    [hourlyRates, preferences, selectedAbsence, selectedDateKey, selectedDaySummaryRecords]
  );
  const summary = useMemo<DashboardSummaryMetrics>(() => {
    const todayMinutes = sumAllocatedRecordMinutes(selectedDaySummaryRecords, selectedDateKey, weeklyAbsences);
    const todayWorkBaseGross = sumAllocatedRecordBaseGross(
      selectedDaySummaryRecords,
      selectedDateKey,
      weeklyAbsences
    );
    const todayBaseGross = todayWorkBaseGross;
    const todayExtraPaid = calculateExtraPaidInRange(
      selectedDaySummaryRecords,
      selectedDateKey,
      selectedDateKey,
      weeklyAbsences
    );
    const absenceGross = sumPaidAbsenceGross(selectedDayPaidAbsences);
    return {
      primaryMetric: null,
      secondaryMetrics: [],
      extraTimeMetric: todayExtraPaid.minutes > 0 ? {
        label: t("dashboard:summary.extraHours"),
        value: formatMinutesAsDuration(todayExtraPaid.minutes),
        hint: ""
      } : null,
      extraMoneyMetric: todayExtraPaid.grossAmount > 0 ? {
        label: t("dashboard:summary.extraMoney"),
        value: formatCombinedGross(
          selectedDaySummaryRecords.filter(hasExtraPay),
          todayExtraPaid.grossAmount,
          t("dashboard:summary.mixedCurrencies")
        ),
        hint: ""
      } : null,
      totalTimeMetric: todayExtraPaid.minutes > 0 ? {
        label: t("dashboard:summary.totalHours"),
        value: formatMinutesAsDuration(todayMinutes + todayExtraPaid.minutes),
        hint: ""
      } : null,
      totalMoneyMetric: todayExtraPaid.grossAmount > 0 ? {
        label: t("dashboard:summary.totalMoney"),
        value: formatCombinedGross(
          selectedDaySummaryRecords,
          todayBaseGross + todayExtraPaid.grossAmount,
          t("dashboard:summary.mixedCurrencies"),
          selectedDayPaidAbsences
        ),
        hint: ""
      } : null,
      absenceMetric: selectedAbsence?.paid ? {
        label: selectedAbsence.absenceTypeName,
        duration: formatMinutesAsDuration(selectedAbsence.paidMinutesPerDay),
        amount: selectedDayPaidAbsences.length > 0
          ? formatCombinedGross(
              [],
              absenceGross,
              t("dashboard:summary.mixedCurrencies"),
              selectedDayPaidAbsences
            )
          : null
      } : null
    };
  }, [
    selectedAbsence,
    selectedDayPaidAbsences,
    selectedDaySummaryRecords,
    selectedDateKey,
    t,
    weeklyAbsences,
  ]);

  const weeklyDays = useMemo(
    () => buildWeeklyRhythmDays(
      weekDays,
      weeklyDailyRecords,
      weeklyAbsences,
      absenceTypesQuery.data ?? [],
      selectedDate,
      t
    ),
    [absenceTypesQuery.data, selectedDate, t, weekDays, weeklyAbsences, weeklyDailyRecords]
  );
  const selectedDayOverview = useMemo(
    () => ({
      label: selectedDayLabel,
      entriesCount: selectedDayRecords.length + (selectedAbsence ? 1 : 0),
      totalDuration: formatMinutesAsDuration(
        sumAllocatedRecordMinutes(selectedDaySummaryRecords, selectedDateKey, weeklyAbsences) +
        sumPaidAbsenceMinutes(selectedDayPaidAbsences)
      ),
      totalGross: formatCombinedGross(
        selectedDaySummaryRecords,
        sumAllocatedRecordGross(selectedDaySummaryRecords, selectedDateKey, weeklyAbsences) +
          sumPaidAbsenceGross(selectedDayPaidAbsences),
        t("dashboard:summary.mixedCurrencies"),
        selectedDayPaidAbsences
      ),
      activities: [
        ...buildSelectedDayActivities(selectedDayRecords, t),
        ...(selectedAbsence ? [toAbsenceActivity(
          selectedAbsence,
          selectedDayPaidAbsences[0]?.minutes ?? 0,
          selectedDayPaidAbsences[0]
            ? formatCurrency(
                String(selectedDayPaidAbsences[0].grossAmount),
                selectedDayPaidAbsences[0].currency
              )
            : "",
          t
        )] : [])
      ]
    }),
    [selectedAbsence, selectedDateKey, selectedDayLabel, selectedDayPaidAbsences, selectedDayRecords, selectedDaySummaryRecords, t, weeklyAbsences]
  );
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (errorQuery) {
    return (
      <DashboardErrorState
        message={getApiError(errorQuery.error).message}
        onRetry={() => {
          void rhythmRecordsQuery.refetch();
          void preferencesQuery.refetch();
          void employmentsQuery.refetch();
          void hourlyRatesQuery.refetch();
          void absenceTypesQuery.refetch();
          void weeklyAbsencesQuery.refetch();
          void restDaysQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="dashboard-glass-preview mx-auto w-full pb-10">
      <DashboardOverview
        summary={summary}
        selectedDay={selectedDayOverview}
        weeklyDays={weeklyDays}
        previousWeekAverageMinutes={averagePositiveValues(
          previousWeekDays.map((date) =>
            sumAllocatedRecordMinutes(previousWeeklyDailyRecords, date, previousWeeklyAbsences)
          )
        )}
        previousWeekAverageGross={averagePositiveValues(
          previousWeekDays.map((date) =>
            sumAllocatedRecordGross(previousWeeklyDailyRecords, date, previousWeeklyAbsences)
          )
        )}
        flowCurrency={weeklyDailyRecords[0]?.currency ?? preferences?.currency ?? "EUR"}
        absenceTypes={absenceTypesQuery.data ?? []}
        restDay={Boolean(selectedRestDay)}
        onMarkRestDay={() => {
          if (!effectiveEmploymentId) {
            setAbsenceScopeError(t("dashboard:restDay.selectEmployment"));
            return;
          }
          setAbsenceScopeError(null);
          markRestDayMutation.mutate({
            employmentId: effectiveEmploymentId,
            date: selectedDateKey
          });
        }}
        onRemoveRestDay={() => {
          if (effectiveEmploymentId) {
            removeRestDayMutation.mutate({
              employmentId: effectiveEmploymentId,
              date: selectedDateKey
            });
          }
        }}
        restDayPending={markRestDayMutation.isPending || removeRestDayMutation.isPending}
        onQuickAdd={() => navigate(`/records/new?date=${selectedDateKey}`)}
        onDaySwipe={(direction) => outletContext?.setSelectedDate?.(addDays(selectedDate, direction))}
        onRhythmDaySelect={(date) => outletContext?.setSelectedDate?.(parseLocalIsoDate(date))}
        onWeekSwipe={(direction) => outletContext?.setSelectedDate?.(addWeeks(selectedDate, direction))}
        onCreateAbsence={(absenceTypeId) => {
          if (!absenceEmploymentId) {
            setAbsenceScopeError(t("dashboard:absence.selectEmployment"));
            return;
          }
          setAbsenceScopeError(null);
          absenceMutation.mutate({
            absenceTypeId,
            date: selectedDateKey,
            employmentId: absenceEmploymentId
          });
        }}
        onConfigureAbsences={() => navigate("/settings/absences")}
        onDeleteAbsence={(activityId) => deleteAbsenceMutation.mutate({
          id: activityId.slice("absence-".length),
          date: selectedDateKey
        })}
        absencePending={absenceMutation.isPending || deleteAbsenceMutation.isPending || Boolean(selectedAbsence)}
        absenceError={absenceScopeError ?? (absenceMutation.error
          ? getApiError(absenceMutation.error).message
          : deleteAbsenceMutation.error
            ? getApiError(deleteAbsenceMutation.error).message
            : markRestDayMutation.error
              ? getApiError(markRestDayMutation.error).message
              : removeRestDayMutation.error
                ? getApiError(removeRestDayMutation.error).message
            : null)}
        onEntrySelect={(entryId) =>
          navigate(`/records/${entryId.slice("record:".length)}?returnDate=${selectedDateKey}`)
        }
        timeTracker={<TimeTrackingCard />}
      />
    </div>
  );
}

function recordTimeMinutes(record: WorkRecord) {
  return (record.workLines ?? [])
    .filter((line) => line.calculationMode === "TIME_HOURLY" || line.calculationMode === "UNITS_PER_HOUR")
    .reduce((total, line) => total + Number(line.calculatedMinutes), 0);
}

function shiftIsoDate(value: string, days: number) {
  return formatLocalIsoDate(addDays(parseLocalIsoDate(value), days));
}

function recordDurationDays(record: WorkRecord) {
  const start = parseLocalIsoDate(record.workDate);
  const end = parseLocalIsoDate(record.workEndDate ?? record.workDate);
  return Math.max(Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1, 1);
}

function sumAllocatedRecordMinutes(records: WorkRecord[], date: string, absences: Absence[]) {
  if (hasAbsenceOnDate(absences, date)) return 0;
  return records.reduce((total, record) => {
    const eligibleDays = recordEligibleDays(record, absences);
    return total + (eligibleDays.includes(date) ? recordTimeMinutes(record) / eligibleDays.length : 0);
  }, 0);
}

function sumAllocatedRecordGross(records: WorkRecord[], date: string, absences: Absence[]) {
  if (hasAbsenceOnDate(absences, date)) return 0;
  return records.reduce((total, record) => {
    const eligibleDays = recordEligibleDays(record, absences);
    return total + (eligibleDays.includes(date) ? Number(record.grossAmount) / eligibleDays.length : 0);
  }, 0);
}

function sumAllocatedRecordBaseGross(records: WorkRecord[], date: string, absences: Absence[]) {
  if (hasAbsenceOnDate(absences, date)) return 0;
  return records.reduce((total, record) => {
    const eligibleDays = recordEligibleDays(record, absences);
    if (!eligibleDays.includes(date)) return total;
    const baseGross = record.baseGrossAmount === undefined
      ? Number(record.grossAmount) - legacyExtraGross(record)
      : Number(record.baseGrossAmount);
    return total + baseGross / eligibleDays.length;
  }, 0);
}

function recordEligibleDays(record: WorkRecord, absences: Absence[]) {
  const endDate = record.workEndDate ?? record.workDate;
  const days: string[] = [];
  for (let date = record.workDate; date <= endDate; date = shiftIsoDate(date, 1)) {
    if (!hasAbsenceOnDate(absences, date)) days.push(date);
  }
  return days;
}

function hasAbsenceOnDate(absences: Absence[], date: string) {
  return absences.some((absence) => absence.startDate <= date && absence.endDate >= date);
}

function recordCoversDate(record: WorkRecord, date: string) {
  return record.workDate <= date && (record.workEndDate ?? record.workDate) >= date;
}

function isProjectTotalRecord(record: WorkRecord) {
  return record.entryKind === "WORK_RECORD" && Boolean(record.workEndDate);
}

function recordOverlapsRange(record: WorkRecord, fromDate: string, toDate: string) {
  return record.workDate <= toDate && (record.workEndDate ?? record.workDate) >= fromDate;
}

function absenceOverlapsRange(absence: Absence, fromDate: string, toDate: string) {
  return absence.startDate <= toDate && absence.endDate >= fromDate;
}

function formatCombinedGross(
  records: WorkRecord[],
  total: number,
  mixedCurrencyLabel: string,
  paidAbsences: Array<{ currency: string }> = []
) {
  const currencies = new Set([
    ...records.map((record) => record.currency).filter(Boolean),
    ...paidAbsences.map((absence) => absence.currency)
  ]);

  if (currencies.size > 1) {
    return mixedCurrencyLabel;
  }

  return formatCurrency(
    String(total),
    records[0]?.currency ?? paidAbsences[0]?.currency ?? "EUR"
  );
}

function sumPaidAbsenceMinutes(absences: Array<{ minutes: number }>) {
  return absences.reduce((total, absence) => total + absence.minutes, 0);
}

function sumPaidAbsenceGross(absences: Array<{ grossAmount: number }>) {
  return absences.reduce((total, absence) => total + absence.grossAmount, 0);
}

function averagePositiveValues(values: number[]) {
  const positiveValues = values.filter((value) => value > 0);
  return positiveValues.length > 0
    ? positiveValues.reduce((total, value) => total + value, 0) / positiveValues.length
    : 0;
}

function hasExtraPay(record: WorkRecord) {
  return record.workLines?.some((line) => (line.extraPayPercentage ?? 0) > 0) ?? false;
}

function legacyExtraGross(record: WorkRecord) {
  return record.workLines?.reduce((total, line) => {
    const percentage = line.extraPayPercentage ?? 0;
    return percentage > 0
      ? total + Number(line.grossAmount) * (percentage / (100 + percentage))
      : total;
  }, 0) ?? 0;
}

function calculateExtraPaidInRange(
  records: WorkRecord[],
  fromDate: string,
  toDate: string,
  absences: Absence[]
) {
  return records.reduce((total, record) => {
    const eligibleDays = recordEligibleDays(record, absences);
    if (eligibleDays.length === 0) return total;
    const overlapDays = eligibleDays.filter((date) => date >= fromDate && date <= toDate).length;
    const allocation = overlapDays / eligibleDays.length;

    record.workLines?.forEach((line) => {
      const percentage = line.extraPayPercentage ?? 0;
      if (percentage <= 0) return;
      const extraMinutes = line.extraPaidEquivalentMinutes === undefined
        ? Number(line.calculatedMinutes) * (percentage / 100)
        : Number(line.extraPaidEquivalentMinutes);
      const extraGross = line.extraGrossAmount === undefined
        ? Number(line.grossAmount) * (percentage / (100 + percentage))
        : Number(line.extraGrossAmount);
      total.minutes += extraMinutes * allocation;
      total.grossAmount += extraGross * allocation;
    });
    return total;
  }, { minutes: 0, grossAmount: 0 });
}

function buildSelectedDayActivities(
  records: WorkRecord[],
  t: ReturnType<typeof useTranslation<["dashboard", "common"]>>["t"]
): SelectedDayActivity[] {
  return records
    .filter((record) => record.workLines?.length)
    .map((record) => toPhaseTwoWorkRecordActivity(record, t));
}

function toPhaseTwoWorkRecordActivity(
  record: WorkRecord,
  t: ReturnType<typeof useTranslation<["dashboard", "common"]>>["t"]
) {
  const workLines = record.workLines ?? [];
  const timeLines = workLines
    .filter((line) => line.calculationMode === "TIME_HOURLY" || line.calculationMode === "UNITS_PER_HOUR");
  const minutes = timeLines
    .reduce((total, line) => total + Number(line.calculatedMinutes), 0);
  const mixedCurrencyLabel = t("dashboard:summary.mixedCurrencies");
  const currencies = new Set(workLines.map((line) => line.currencySnapshot));
  const extraMinutes = workLines.reduce((total, line) => {
    const percentage = line.extraPayPercentage ?? 0;
    if (percentage <= 0) return total;
    return total + (line.extraPaidEquivalentMinutes === undefined
      ? Number(line.calculatedMinutes) * (percentage / 100)
      : Number(line.extraPaidEquivalentMinutes));
  }, 0);
  const extraGross = workLines.reduce((total, line) => {
    const percentage = line.extraPayPercentage ?? 0;
    if (percentage <= 0) return total;
    return total + (line.extraGrossAmount === undefined
      ? Number(line.grossAmount) * (percentage / (100 + percentage))
      : Number(line.extraGrossAmount));
  }, 0);
  const durationDays = recordDurationDays(record);
  const spansMultipleDays = durationDays > 1;

  return {
    id: `record:${record.id}`,
    title: "",
    kind: "UNIT_BASED" as const,
    subtitle: spansMultipleDays
      ? t("dashboard:selectedDay.jobDays", { count: durationDays })
      : "",
    projectTitle: record.projectTitle ?? null,
    projectNotes: record.projectNotes ?? null,
    teamSize: record.teamSize ?? null,
    address: record.address?.formatted ?? null,
    notes: record.notes,
    periodLabel: spansMultipleDays ? formatRecordPeriod(record) : null,
    duration: timeLines.length ? formatMinutesAsDuration(minutes) : "",
    amount:
      currencies.size === 1 && record.currency
        ? formatCurrency(record.grossAmount, record.currency)
        : mixedCurrencyLabel,
    extraDuration: extraMinutes > 0 ? formatMinutesAsDuration(extraMinutes) : null,
    extraAmount: extraGross > 0
      ? currencies.size === 1
        ? formatCurrency(String(extraGross), workLines[0]?.currencySnapshot ?? record.currency)
        : mixedCurrencyLabel
      : null,
    extraPayLabel: null,
    unitBreakdown: workLines.flatMap((line) => toPhaseTwoLineBreakdown(line))
  };
}

function toPhaseTwoLineBreakdown(
  line: WorkRecordLine
): SelectedDayActivity["unitBreakdown"] {
  const interval = line.startTime && line.endTime
    ? `${line.startTime.slice(0, 5)}–${line.endTime.slice(0, 5)}`
    : null;
  const calculatedMinutes = Number(line.workedMinutes ?? line.calculatedMinutes ?? 0);
  const hours = calculatedMinutes > 0
    ? formatMinutesAsDuration(calculatedMinutes)
    : line.durationMinutes != null
      ? formatMinutesAsDuration(line.durationMinutes)
      : null;
  const price = formatCurrency(
    line.totalGrossAmount ?? line.grossAmount ?? line.fixedAmountSnapshot ?? "0",
    line.currencySnapshot
  );
  const base: SelectedDayActivity["unitBreakdown"][number] = {
    id: line.id,
    label: line.workTypeName,
    enteredValue:
      line.calculationMode === "FIXED_AMOUNT"
        ? price
        : line.calculationMode === "UNITS_PER_HOUR" || line.calculationMode === "UNITS_PER_UNIT"
          ? (() => {
              const unit = line.unitSymbol ?? line.unitLabel ?? "";
              return unit ? `${line.quantity ?? "0"} ${unit}` : (line.quantity ?? "0");
            })()
          : line.durationMinutes != null
            ? formatMinutesAsDuration(line.durationMinutes)
            : interval ?? hours,
    interval,
    hours: line.calculationMode === "FIXED_AMOUNT" || line.calculationMode === "UNITS_PER_UNIT"
      ? null
      : hours,
    price,
    extraPayPercentage: line.extraPayPercentage,
    displayOrder: line.displayOrder
  };

  if (
    line.calculationMode === "TIME_HOURLY" ||
    line.calculationMode === "TIME_ONLY" ||
    line.calculationMode === "FIXED_AMOUNT"
  ) {
    return [{ ...base, quantity: null }];
  }

  const unit = line.unitSymbol ?? line.unitLabel ?? "";
  const quantity = unit
    ? `${formatQuantity(line.quantity ?? "0")} ${unit}`
    : formatQuantity(line.quantity ?? "0");
  return [
    {
      ...base,
      quantity,
    }
  ];
}

function toAbsenceActivity(
  absence: Absence,
  paidMinutes: number,
  paidAmount: string,
  t: ReturnType<typeof useTranslation<["dashboard", "common"]>>["t"]
) {
  const marker = absenceMarker(absence.absenceType);
  return {
    id: `absence-${absence.id}`,
    title: absence.absenceTypeName || t(`dashboard:absence.${marker}`),
    kind: "ABSENCE" as const,
    subtitle: t("dashboard:absence.dayOff"),
    duration: paidMinutes > 0
      ? t("dashboard:selectedDay.equivalentTime", {
          duration: formatMinutesAsDuration(paidMinutes)
        })
      : t("dashboard:absence.noWork"),
    amount: paidAmount,
    unitBreakdown: [],
    marker
  };
}

function absenceMarker(absenceType: Absence["absenceType"]) {
  if (absenceType === "SICK_LEAVE") {
    return "sick" as const;
  }
  if (absenceType === "VACATION") {
    return "vacation" as const;
  }
  return "free" as const;
}

const DAILY_TARGET_MINUTES = 8 * 60;

function buildWeeklyRhythmDays(
  days: Date[],
  records: WorkRecord[],
  absences: Absence[],
  absenceTypes: AbsenceTypeSetting[],
  selectedDate: Date,
  t: ReturnType<typeof useTranslation<["dashboard", "common"]>>["t"]
): WeeklyRhythmDay[] {
  const minutesPerDay = days.map((day) => {
    const date = formatLocalIsoDate(day);
    if (hasAbsenceOnDate(absences, date)) return 0;
    const coveringRecords = records.filter((record) => recordCoversDate(record, formatLocalIsoDate(day)));
    return coveringRecords.reduce(
      (total, record) => {
        const eligibleDays = recordEligibleDays(record, absences);
        return total + (eligibleDays.length > 0 ? recordTimeMinutes(record) / eligibleDays.length : 0);
      },
      0
    );
  });
  const grossPerDay = days.map((day) => {
    const date = formatLocalIsoDate(day);
    if (hasAbsenceOnDate(absences, date)) return 0;
    return records
      .filter((record) => recordCoversDate(record, date))
      .reduce((total, record) => {
        const eligibleDays = recordEligibleDays(record, absences);
        return total + (eligibleDays.length > 0 ? Number(record.grossAmount) / eligibleDays.length : 0);
      }, 0);
  });
  const extraPaidPerDay = days.map((day) => {
    const date = formatLocalIsoDate(day);
    return calculateExtraPaidInRange(records, date, date, absences);
  });
  const extraPayPercentagesPerDay = days.map((day) => {
    const date = formatLocalIsoDate(day);
    if (hasAbsenceOnDate(absences, date)) return [];
    return records
      .filter((record) => recordCoversDate(record, date))
      .flatMap((record) => record.workLines ?? [])
      .map((line) => line.extraPayPercentage ?? 0)
      .filter((percentage) => percentage > 0)
      .sort((left, right) => left - right);
  });
  const maximumDailyMinutes = Math.max(...minutesPerDay, 0);
  return days.map((day, index) => {
    const absence = absences.find((item) => absenceCoversDate(item, day));
    const absenceType = absence ? absenceMarker(absence.absenceType) : null;
    const absenceColor = absence
      ? absenceTypes.find((type) => type.id === absence.absenceTypeId)?.color ?? "#737373"
      : "#737373";
    const minutes = minutesPerDay[index] ?? 0;
    const amount = grossPerDay[index] ?? 0;
    const extraMinutes = extraPaidPerDay[index]?.minutes ?? 0;
    const extraAmount = extraPaidPerDay[index]?.grossAmount ?? 0;
    const hasEntries = minutes > 0;
    const difference = minutes - DAILY_TARGET_MINUTES;
    const status = absence
      ? "absence"
      : !hasEntries
      ? "idle"
      : difference < 0
        ? "under"
        : difference > 0
          ? "over"
          : "met";

    return {
      key: formatLocalIsoDate(day),
      label: new Intl.DateTimeFormat(i18n.resolvedLanguage, {
        weekday: "short"
      }).format(day),
      value: formatMinutesAsDuration(minutes),
      minutes,
      amount,
      extraMinutes,
      baseAmount: Math.max(amount - extraAmount, 0),
      extraAmount,
      extraPayPercentages: extraPayPercentagesPerDay[index] ?? [],
      markerLabel: hasEntries && difference !== 0 ? formatTargetDifferenceMarker(difference) : null,
      status,
      absence: absenceType
        ? {
            type: absenceType,
            label: absence?.absenceTypeName ?? t(`dashboard:absence.${absenceType}`),
            color: absenceColor
          }
        : null,
      percentage: maximumDailyMinutes > 0
        ? Math.round((minutes / maximumDailyMinutes) * 100)
        : 0,
      selected: isSameDay(day, selectedDate)
    };
  });
}

function formatRecordPeriod(record: WorkRecord) {
  const formatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, { day: "numeric", month: "short" });
  return `${formatter.format(parseLocalIsoDate(record.workDate))}–${formatter.format(parseLocalIsoDate(record.workEndDate ?? record.workDate))}`;
}

function absenceCoversDate(absence: Absence, date: Date) {
  const key = formatLocalIsoDate(date);
  return absence.startDate <= key && absence.endDate >= key;
}

function formatTargetDifferenceMarker(minutes: number) {
  const hours = Math.abs(minutes) / 60;
  const prefix = minutes > 0 ? "+" : "-";
  return new Intl.NumberFormat(i18n.resolvedLanguage, {
    maximumFractionDigits: 1
  }).format(hours).replace(/^/, prefix);
}

function formatSelectedDayLabel(date: Date, todayLabel: string) {
  if (isSameDay(date, new Date())) {
    return todayLabel;
  }

  return new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
}

function formatQuantity(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Intl.NumberFormat(i18n.resolvedLanguage, {
    maximumFractionDigits: 2
  }).format(parsed);
}

function matchesEmployment(value: string | null | undefined, selectedEmploymentId: string | null) {
  return !selectedEmploymentId || value === selectedEmploymentId;
}
