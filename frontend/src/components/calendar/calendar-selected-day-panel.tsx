import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { WorkRecord, WorkRecordLine } from "../../types/work-record";
import type { Absence } from "../../types/absence";
import type { SelectedDayActivity } from "../../types/dashboard";
import { SelectedDayActivityCard } from "../dashboard/selected-day-activity-card";
import { daysBetweenInclusive, parseLocalIsoDate } from "../../utils/date";
import { formatCurrency, formatMinutesAsDuration } from "../../utils/format";

type Props = {
  title: string;
  records?: WorkRecord[];
  absence: Absence | null;
  paidAbsenceMinutes?: number;
  absenceColor?: string;
  onEntrySelect: (entryId: string) => void;
};

export function CalendarSelectedDayPanel({
  title,
  records = [],
  absence,
  paidAbsenceMinutes = 0,
  absenceColor,
  onEntrySelect
}: Props) {
  const { t } = useTranslation("calendar");
  const hasContent = records.length > 0 || absence;
  const titleEyebrow = title.replace(",", "").toUpperCase();
  const activities = buildCalendarActivities(records, t);

  return (
    <section className="space-y-4" aria-label="Selected day details">
      <p className="hairline-text">{titleEyebrow}</p>

      <AnimatePresence mode="popLayout" initial={false}>
        {activities.length ? (
          <motion.div
            key={`entries-${title}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3"
          >
            {activities.map((activity) => (
              <SelectedDayActivityCard
                key={activity.id}
                activity={activity}
                onSelect={onEntrySelect}
              />
            ))}
          </motion.div>
        ) : null}

        {!hasContent ? (
          <motion.div
            key={`empty-${title}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="dashboard-glass-card px-5 py-4"
          >
            <p className="font-semibold tracking-[-0.03em] text-white">{t("emptyDay")}</p>
          </motion.div>
        ) : null}

        {absence ? (
          <motion.div
            key={`absence-${absence.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="dashboard-glass-card px-5 py-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold tracking-[-0.03em] text-white">
                  {absence.absenceTypeName || absenceTitle(absence.absenceType, t)}
                </p>
                <p className="mt-1 text-sm text-white/52">{t("absence.dayOff")}</p>
              </div>
              <span
                className={`mt-1 h-2.5 w-2.5 rounded-full ${absenceColor ? "" : absenceMarkerClassName(absence.absenceType)}`}
                style={absenceColor ? { backgroundColor: absenceColor } : undefined}
                aria-hidden="true"
              />
            </div>
            <p className="mt-3 text-sm text-white/40">
              {paidAbsenceMinutes > 0
                ? t("equivalentWorked", {
                    duration: formatMinutesAsDuration(paidAbsenceMinutes)
                  })
                : `${countAbsenceDays(absence)} ${t("absence.days")}`}
            </p>
            {absence.notes ? (
              <p className="pt-1 text-sm leading-6 text-white/58">{absence.notes}</p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function countAbsenceDays(absence: Absence) {
  return daysBetweenInclusive(
    parseLocalIsoDate(absence.startDate),
    parseLocalIsoDate(absence.endDate)
  );
}

function buildCalendarActivities(
  records: WorkRecord[],
  t: ReturnType<typeof useTranslation<"calendar">>["t"]
): SelectedDayActivity[] {
  return records
    .filter((record) => record.workLines?.length)
    .sort((left, right) => recordStartValue(left).localeCompare(recordStartValue(right)))
    .map((record) => toPhaseTwoRecordActivity(record, t));
}

function recordStartValue(record: WorkRecord) {
  const startTime = record.workLines?.find((line) => line.startTime)?.startTime ?? "23:59";
  return `${record.workDate}T${startTime}`;
}

function toPhaseTwoRecordActivity(record: WorkRecord, t: ReturnType<typeof useTranslation<"calendar">>["t"]) {
  const workLines = record.workLines ?? [];
  const timeLines = workLines.filter(
    (line) => line.calculationMode === "TIME_HOURLY" || line.calculationMode === "UNITS_PER_HOUR"
  );
  const minutes = timeLines.reduce((total, line) => total + Number(line.calculatedMinutes), 0);
  const currencies = new Set(workLines.map((line) => line.currencySnapshot));
  const durationDays = daysBetweenInclusive(
    parseLocalIsoDate(record.workDate),
    parseLocalIsoDate(record.workEndDate ?? record.workDate)
  );

  return {
    id: `record:${record.id}`,
    title: "",
    kind: "UNIT_BASED" as const,
    subtitle: record.workEndDate ? t("jobDays", { count: durationDays }) : "",
    address: record.address?.formatted ?? null,
    periodLabel: record.workEndDate ? formatRecordPeriod(record) : null,
    amount: currencies.size === 1 && record.currency
      ? formatCurrency(record.grossAmount, record.currency)
      : t("mixedCurrencies"),
    extraPayLabel: null,
    duration: timeLines.length ? formatMinutesAsDuration(minutes) : "",
    unitBreakdown: workLines.flatMap(toPhaseTwoLineBreakdown)
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
    return [
      {
        id: line.id,
        label: line.workTypeName,
        quantity: formatCurrency(line.fixedAmountSnapshot ?? "0", line.currencySnapshot),
        displayOrder: line.displayOrder
      }
    ];
  }
  const unit = line.unitSymbol ?? line.unitLabel ?? "";
  return [
    {
      id: line.id,
      label: line.workTypeName,
      quantity: unit ? `${Number(line.quantity ?? 0).toLocaleString()} ${unit}` : Number(line.quantity ?? 0).toLocaleString(),
      displayOrder: line.displayOrder
    }
  ];
}

function formatRecordPeriod(record: WorkRecord) {
  const formatter = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
  return `${formatter.format(parseLocalIsoDate(record.workDate))}–${formatter.format(
    parseLocalIsoDate(record.workEndDate ?? record.workDate)
  )}`;
}

function absenceTitle(absenceType: Absence["absenceType"], t: ReturnType<typeof useTranslation<"calendar">>["t"]) {
  if (absenceType === "SICK_LEAVE") {
    return t("absence.sick");
  }
  if (absenceType === "VACATION") {
    return t("absence.vacation");
  }
  return t("absence.free");
}

function absenceMarkerClassName(absenceType: Absence["absenceType"]) {
  if (absenceType === "SICK_LEAVE") {
    return "bg-red-500/90";
  }
  if (absenceType === "VACATION") {
    return "bg-emerald-500/90";
  }
  return "absence-dot-free border border-white/28";
}
