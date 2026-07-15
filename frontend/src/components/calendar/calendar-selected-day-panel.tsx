import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { WorkEntry } from "../../types/work-entry";
import type { Absence } from "../../types/absence";
import { UnitBreakdownBadges } from "../work-entry/unit-breakdown-badges";
import { daysBetweenInclusive, parseLocalIsoDate } from "../../utils/date";
import { formatCurrency, formatMinutesAsDuration, formatTimeRange } from "../../utils/format";

type Props = {
  title: string;
  entries: WorkEntry[];
  absence: Absence | null;
  paidAbsenceMinutes?: number;
  onEntrySelect: (entryId: string) => void;
};

export function CalendarSelectedDayPanel({
  title,
  entries,
  absence,
  paidAbsenceMinutes = 0,
  onEntrySelect
}: Props) {
  const { t } = useTranslation("calendar");
  const hasContent = entries.length > 0 || absence;
  const titleEyebrow = title.replace(",", "").toUpperCase();

  return (
    <section className="space-y-4" aria-label="Selected day details">
      <p className="hairline-text">{titleEyebrow}</p>

      <AnimatePresence mode="popLayout" initial={false}>
        {entries.length ? (
          <motion.div
            key={`entries-${title}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3"
          >
            {entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onEntrySelect(entry.id)}
                className="dashboard-glass-card w-full px-5 py-4 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold tracking-[-0.03em] text-white">
                      {entry.workTypeName}
                    </p>
                    {formatTimeRange(entry.timeEntry?.startTime, entry.timeEntry?.endTime) ? (
                      <p className="mt-1 text-sm text-white/52">
                        {formatTimeRange(entry.timeEntry?.startTime, entry.timeEntry?.endTime)}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-sm font-semibold text-white/90">
                      {formatCurrency(entry.grossAmount, entry.currencySnapshot)}
                    </p>
                    {(entry.extraPayPercentage ?? 0) > 0 ? (
                      <p className="text-xs font-semibold text-amber-200">+{entry.extraPayPercentage}%</p>
                    ) : null}
                  </div>
                </div>
                {entry.unitItems.length ? (
                  <UnitBreakdownBadges
                    items={entry.unitItems.map((item) => ({
                      id: item.id,
                      label: item.unitName,
                      quantity: Number(item.quantity).toLocaleString(),
                      displayOrder: item.displayOrder
                    }))}
                  />
                ) : null}
                <p className="mt-3 text-sm text-white/40">
                  {entry.calculationMethod === "UNIT_BASED"
                    ? t("equivalentWorked", {
                        duration: formatMinutesAsDuration(Number(entry.calculatedMinutes))
                      })
                    : formatMinutesAsDuration(Number(entry.calculatedMinutes))}
                </p>
              </button>
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
                  {absenceTitle(absence.absenceType, t)}
                </p>
                <p className="mt-1 text-sm text-white/52">{t("absence.dayOff")}</p>
              </div>
              <span className={`mt-1 h-2.5 w-2.5 rounded-full ${absenceMarkerClassName(absence.absenceType)}`} aria-hidden="true" />
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
