import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  createAbsence,
  deleteAbsence,
  getAbsences,
  getPreferences,
  listAbsenceTypes,
  listHourlyRates,
  listWorkRecordsInRange
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { i18n } from "../i18n";
import { DashboardErrorState } from "../components/dashboard/dashboard-error-state";
import { DashboardOverview } from "../components/dashboard/dashboard-overview";
import { DashboardSkeleton } from "../components/dashboard/dashboard-skeleton";
import type { DashboardSummaryMetrics, SelectedDayActivity, WeeklyRhythmDay } from "../types/dashboard";
import type { Absence, AbsenceTypeSetting } from "../types/absence";
import type { WorkRecord, WorkRecordLine } from "../types/work-record";
import { addDays, addWeeks, formatLocalIsoDate, isSameDay, parseLocalIsoDate, safeLocalIsoDate, startOfWeek } from "../utils/date";
import {
  formatCurrency,
  formatMinutesAsDuration
} from "../utils/format";
import { calculatePaidAbsenceDays } from "../utils/paid-absence";

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

  const rhythmRecordsQuery = useQuery({
    queryKey: queryKeys.workRecords.range({ from: previousWeekStartKey, to: weekEndKey }),
    queryFn: () => listWorkRecordsInRange({ from: previousWeekStartKey, to: weekEndKey })
  });
  const preferencesQuery = useQuery({
    queryKey: queryKeys.preferences(),
    queryFn: getPreferences
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
  const absenceMutation = useMutation({
    mutationFn: ({ absenceTypeId, date }: { absenceTypeId: string; date: string }) =>
      createAbsence({
        absenceTypeId,
        startDate: date,
        endDate: date,
        notes: null
      }),
    onSuccess: async (_, variables) => {
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

  const isLoading =
    rhythmRecordsQuery.isLoading ||
    preferencesQuery.isLoading ||
    hourlyRatesQuery.isLoading ||
    absenceTypesQuery.isLoading ||
    weeklyAbsencesQuery.isLoading;
  const errorQuery =
    (rhythmRecordsQuery.error ? rhythmRecordsQuery : null) ??
    (preferencesQuery.error ? preferencesQuery : null) ??
    (hourlyRatesQuery.error ? hourlyRatesQuery : null) ??
    (absenceTypesQuery.error ? absenceTypesQuery : null) ??
    (weeklyAbsencesQuery.error ? weeklyAbsencesQuery : null);

  const rhythmRecords = useMemo(() => rhythmRecordsQuery.data ?? [], [rhythmRecordsQuery.data]);
  const weeklyRecords = useMemo(
    () => rhythmRecords.filter((record) => recordOverlapsRange(record, weekStartKey, weekEndKey)),
    [rhythmRecords, weekEndKey, weekStartKey]
  );
  const previousWeeklyRecords = useMemo(
    () => rhythmRecords.filter((record) => recordOverlapsRange(record, previousWeekStartKey, previousWeekEndKey)),
    [previousWeekEndKey, previousWeekStartKey, rhythmRecords]
  );
  const selectedDayRecords = useMemo(
    () => weeklyRecords.filter((record) => recordCoversDate(record, selectedDateKey)),
    [selectedDateKey, weeklyRecords]
  );
  const preferences = preferencesQuery.data ?? null;
  const hourlyRates = useMemo(() => hourlyRatesQuery.data ?? [], [hourlyRatesQuery.data]);
  const rhythmAbsences = useMemo(
    () => weeklyAbsencesQuery.data?.content ?? [],
    [weeklyAbsencesQuery.data]
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
        activityDates: selectedDayRecords.map((record) => record.workDate),
        hourlyRates,
        preferences,
        from: selectedDateKey,
        to: selectedDateKey
      }),
    [hourlyRates, preferences, selectedAbsence, selectedDateKey, selectedDayRecords]
  );
  const weeklyPaidAbsences = useMemo(
    () =>
      calculatePaidAbsenceDays({
        absences: weeklyAbsences,
        activityDates: weeklyRecords.map((record) => record.workDate),
        hourlyRates,
        preferences,
        from: weekStartKey,
        to: weekEndKey
      }),
    [hourlyRates, preferences, weekEndKey, weekStartKey, weeklyAbsences, weeklyRecords]
  );

  const summary = useMemo<DashboardSummaryMetrics>(() => {
    const todayMinutes = sumAllocatedRecordMinutes(selectedDayRecords, selectedDateKey, weeklyAbsences);
    const absenceMinutes = selectedAbsence
      ? preferences?.preferredDailyMinutes ?? selectedAbsence.paidMinutesPerDay
      : 0;
    const todayGross =
      sumAllocatedRecordGross(selectedDayRecords, selectedDateKey, weeklyAbsences) +
      sumPaidAbsenceGross(selectedDayPaidAbsences);
    const todayExtraPaid = calculateExtraPaidInRange(
      selectedDayRecords,
      selectedDateKey,
      selectedDateKey,
      weeklyAbsences
    );
    const todayPaidMinutes = sumPaidAbsenceMinutes(selectedDayPaidAbsences) + todayExtraPaid.minutes;
    const todayPaidGross = sumPaidAbsenceGross(selectedDayPaidAbsences) + todayExtraPaid.grossAmount;
    const weeklyMinutes = sumAllocatedRecordMinutesInRange(
      weeklyRecords,
      weekStartKey,
      weekEndKey,
      weeklyAbsences
    );
    const weeklyGross =
      sumAllocatedRecordGrossInRange(weeklyRecords, weekStartKey, weekEndKey, weeklyAbsences) +
      sumPaidAbsenceGross(weeklyPaidAbsences);

    return {
      primaryMetric: selectedAbsence
        ? {
            label: selectedDayLabel,
            value: formatMinutesAsDuration(absenceMinutes),
            hint: selectedAbsence.paid && selectedAbsence.paidMinutesPerDay > 0
              ? t("dashboard:summary.paidAbsenceHours", {
                  duration: formatMinutesAsDuration(selectedAbsence.paidMinutesPerDay)
                })
              : ""
          }
        : todayMinutes > 0
          ? {
              label: selectedDayLabel,
              value: formatMinutesAsDuration(todayMinutes),
              hint: ""
            }
          : null,
      secondaryMetrics: [
        {
          label: t("dashboard:summary.gross"),
          value: formatCombinedGross(
            selectedDayRecords,
            todayGross,
            t("dashboard:summary.mixedCurrencies"),
            selectedDayPaidAbsences
          ),
          hint: ""
        },
        ...(weeklyMinutes > 0 ? [{
          label: t("dashboard:summary.week"),
          value: formatMinutesAsDuration(weeklyMinutes),
          hint: "",
          placement: "week" as const
        }] : []),
        ...(todayPaidMinutes > 0 ? [{
          label: t("dashboard:summary.paid"),
          value: formatMinutesAsDuration(todayPaidMinutes),
          hint: formatCombinedGross(
            selectedDayRecords.filter(hasExtraPay),
            todayPaidGross,
            t("dashboard:summary.mixedCurrencies"),
            selectedDayPaidAbsences
          ),
          placement: "financial" as const
        }] : [])
      ],
      tertiaryMetric: {
        label: t("dashboard:summary.flow"),
        value: formatCombinedGross(
          weeklyRecords,
          weeklyGross,
          t("dashboard:summary.mixedCurrencies"),
          weeklyPaidAbsences
        ),
        hint: ""
      }
    };
  }, [
    selectedDayLabel,
    selectedDayPaidAbsences,
    selectedDayRecords,
    selectedDateKey,
    selectedAbsence,
    preferences,
    t,
    weekEndKey,
    weekStartKey,
    weeklyPaidAbsences,
    weeklyAbsences,
    weeklyRecords
  ]);

  const weeklyDays = useMemo(
    () => buildWeeklyRhythmDays(
      weekDays,
      weeklyRecords,
      weeklyAbsences,
      absenceTypesQuery.data ?? [],
      selectedDate,
      t
    ),
    [absenceTypesQuery.data, selectedDate, t, weekDays, weeklyAbsences, weeklyRecords]
  );
  const selectedDayOverview = useMemo(
    () => ({
      label: selectedDayLabel,
      entriesCount: selectedDayRecords.length + (selectedAbsence ? 1 : 0),
      totalDuration: formatMinutesAsDuration(
        sumAllocatedRecordMinutes(selectedDayRecords, selectedDateKey, weeklyAbsences) +
        sumPaidAbsenceMinutes(selectedDayPaidAbsences)
      ),
      totalGross: formatCombinedGross(
        selectedDayRecords,
        sumAllocatedRecordGross(selectedDayRecords, selectedDateKey, weeklyAbsences) +
          sumPaidAbsenceGross(selectedDayPaidAbsences),
        t("dashboard:summary.mixedCurrencies"),
        selectedDayPaidAbsences
      ),
      activities: [
        ...buildSelectedDayActivities(selectedDayRecords, t),
        ...(selectedAbsence ? [toAbsenceActivity(selectedAbsence, selectedDayPaidAbsences[0]?.minutes ?? 0, t)] : [])
      ]
    }),
    [selectedAbsence, selectedDateKey, selectedDayLabel, selectedDayPaidAbsences, selectedDayRecords, t, weeklyAbsences]
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
          void hourlyRatesQuery.refetch();
          void absenceTypesQuery.refetch();
          void weeklyAbsencesQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="mx-auto w-full pb-10">
      <DashboardOverview
        summary={summary}
        selectedDay={selectedDayOverview}
        weeklyDays={weeklyDays}
        previousWeekMinutes={sumAllocatedRecordMinutesInRange(
          previousWeeklyRecords,
          previousWeekStartKey,
          previousWeekEndKey,
          previousWeeklyAbsences
        )}
        previousWeekGross={sumAllocatedRecordGrossInRange(
          previousWeeklyRecords,
          previousWeekStartKey,
          previousWeekEndKey,
          previousWeeklyAbsences
        )}
        flowCurrency={weeklyRecords[0]?.currency ?? preferences?.currency ?? "EUR"}
        absenceTypes={absenceTypesQuery.data ?? []}
        onQuickAdd={() => navigate(`/records/new?date=${selectedDateKey}`)}
        onDaySwipe={(direction) => outletContext?.setSelectedDate?.(addDays(selectedDate, direction))}
        onRhythmDaySelect={(date) => outletContext?.setSelectedDate?.(parseLocalIsoDate(date))}
        onWeekSwipe={(direction) => outletContext?.setSelectedDate?.(addWeeks(selectedDate, direction))}
        onCreateAbsence={(absenceTypeId) => absenceMutation.mutate({ absenceTypeId, date: selectedDateKey })}
        onDeleteAbsence={(activityId) => deleteAbsenceMutation.mutate({
          id: activityId.slice("absence-".length),
          date: selectedDateKey
        })}
        absencePending={absenceMutation.isPending || deleteAbsenceMutation.isPending || Boolean(selectedAbsence)}
        absenceError={absenceMutation.error
          ? getApiError(absenceMutation.error).message
          : deleteAbsenceMutation.error
            ? getApiError(deleteAbsenceMutation.error).message
            : null}
        onEntrySelect={(entryId) =>
          navigate(`/records/${entryId.slice("record:".length)}?returnDate=${selectedDateKey}`)
        }
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

function sumAllocatedRecordMinutesInRange(
  records: WorkRecord[],
  fromDate: string,
  toDate: string,
  absences: Absence[]
) {
  return records.reduce((total, record) => {
    const eligibleDays = recordEligibleDays(record, absences);
    if (eligibleDays.length === 0) return total;
    const overlapDays = eligibleDays.filter((date) => date >= fromDate && date <= toDate).length;
    return total + (recordTimeMinutes(record) / eligibleDays.length) * overlapDays;
  }, 0);
}

function sumAllocatedRecordGross(records: WorkRecord[], date: string, absences: Absence[]) {
  if (hasAbsenceOnDate(absences, date)) return 0;
  return records.reduce((total, record) => {
    const eligibleDays = recordEligibleDays(record, absences);
    return total + (eligibleDays.includes(date) ? Number(record.grossAmount) / eligibleDays.length : 0);
  }, 0);
}

function sumAllocatedRecordGrossInRange(
  records: WorkRecord[],
  fromDate: string,
  toDate: string,
  absences: Absence[]
) {
  return records.reduce((total, record) => {
    const eligibleDays = recordEligibleDays(record, absences);
    if (eligibleDays.length === 0) return total;
    const overlapDays = eligibleDays.filter((date) => date >= fromDate && date <= toDate).length;
    return total + (Number(record.grossAmount) / eligibleDays.length) * overlapDays;
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

function hasExtraPay(record: WorkRecord) {
  return record.workLines?.some((line) => (line.extraPayPercentage ?? 0) > 0) ?? false;
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
      total.minutes += Number(line.calculatedMinutes) * (percentage / 100) * allocation;
      total.grossAmount += Number(line.grossAmount) * (percentage / (100 + percentage)) * allocation;
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

  return {
    id: `record:${record.id}`,
    title: "",
    kind: "UNIT_BASED" as const,
    subtitle: record.workEndDate
      ? t("dashboard:selectedDay.jobDays", { count: recordDurationDays(record) })
      : "",
    address: record.address?.formatted ?? null,
    periodLabel: record.workEndDate ? formatRecordPeriod(record) : null,
    duration: timeLines.length ? formatMinutesAsDuration(minutes) : "",
    amount:
      currencies.size === 1 && record.currency
        ? formatCurrency(record.grossAmount, record.currency)
        : mixedCurrencyLabel,
    extraPayLabel: null,
    unitBreakdown: workLines.flatMap((line) => toPhaseTwoLineBreakdown(line))
  };
}

function toPhaseTwoLineBreakdown(line: WorkRecordLine) {
  if (line.calculationMode === "TIME_HOURLY") {
    const enteredTime = line.durationMinutes != null
      ? formatMinutesAsDuration(line.durationMinutes)
      : line.startTime && line.endTime
        ? `${line.startTime.slice(0, 5)}–${line.endTime.slice(0, 5)}`
        : "";
    return [{
      id: line.id,
      label: line.workTypeName,
      quantity: enteredTime,
      displayOrder: line.displayOrder
    }];
  }
  if (line.calculationMode === "FIXED_AMOUNT") {
    return [{
      id: line.id,
      label: line.workTypeName,
      quantity: formatCurrency(line.fixedAmountSnapshot ?? "0", line.currencySnapshot),
      displayOrder: line.displayOrder
    }];
  }
  const unit = line.unitSymbol ?? line.unitLabel ?? "";
  const quantity = unit
    ? `${formatQuantity(line.quantity ?? "0")} ${unit}`
    : formatQuantity(line.quantity ?? "0");
  return [
    {
      id: line.id,
      label: line.workTypeName,
      quantity,
      displayOrder: line.displayOrder
    }
  ];
}

function toAbsenceActivity(absence: Absence, paidMinutes: number, t: ReturnType<typeof useTranslation<["dashboard", "common"]>>["t"]) {
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
    amount: "",
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
  const maximumDailyMinutes = Math.max(...minutesPerDay, 0);
  return days.map((day, index) => {
    const absence = absences.find((item) => absenceCoversDate(item, day));
    const absenceType = absence ? absenceMarker(absence.absenceType) : null;
    const absenceColor = absence
      ? absenceTypes.find((type) => type.id === absence.absenceTypeId)?.color ?? "#737373"
      : "#737373";
    const minutes = minutesPerDay[index] ?? 0;
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
      amount: grossPerDay[index] ?? 0,
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
