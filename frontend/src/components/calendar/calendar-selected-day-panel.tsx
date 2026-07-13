import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CalendarDays, MoonStar, Plus } from "lucide-react";
import { Button } from "../ui/button";
import type { WorkEntry } from "../../types/work-entry";
import type { Absence } from "../../types/absence";
import { formatCurrency, formatMinutesAsDuration, formatTimeRange } from "../../utils/format";

type Props = {
  title: string;
  entries: WorkEntry[];
  absence: Absence | null;
  onAddEntry: () => void;
  onEntrySelect: (entryId: string) => void;
};

function formatAbsenceType(value: Absence["absenceType"]) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function CalendarSelectedDayPanel({
  title,
  entries,
  absence,
  onAddEntry,
  onEntrySelect
}: Props) {
  const hasContent = entries.length > 0 || absence;
  const titleEyebrow = title.replace(",", "").toUpperCase();
  const absenceStatus = resolveAbsenceStatus(absence);

  return (
    <section className="space-y-4" aria-label="Selected day details">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/34">{titleEyebrow}</p>
        <p className="text-[1.42rem] font-semibold tracking-[-0.06em] text-white">{title}</p>
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        {entries.length ? (
          <motion.div
            key={`entries-${title}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-[32px] border border-white/[0.045] bg-white/[0.022] shadow-[0_20px_50px_rgba(0,0,0,0.16)] backdrop-blur-[18px]"
          >
            {entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onEntrySelect(entry.id)}
                className="w-full border-b border-white/[0.045] px-5 py-5 text-left transition hover:bg-white/[0.02] focus:outline-none focus:ring-2 focus:ring-white/24 focus:ring-inset last:border-b-0 sm:px-6 sm:py-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex min-h-12 w-12 flex-col items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.05] bg-white/[0.03] sm:h-14 sm:w-14">
                        <CalendarDays className="h-5 w-5 text-white/66 sm:h-[22px] sm:w-[22px]" />
                      </div>
                      <span className="mt-2 h-2 w-2 rounded-full bg-white/80" aria-hidden="true" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[1.18rem] font-semibold tracking-[-0.045em] text-white sm:text-[1.2rem]">
                        {entry.workTypeName}
                      </p>
                      <p className="text-[1.02rem] tracking-[-0.03em] text-white/70">
                        {formatTimeRange(entry.timeEntry?.startTime, entry.timeEntry?.endTime) ??
                          `${entry.unitItems.length} unit row${entry.unitItems.length === 1 ? "" : "s"}`}
                      </p>
                      <p className="text-[0.92rem] text-white/46">
                        {formatMinutesAsDuration(Number(entry.calculatedMinutes))}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-3 pt-1">
                    <p className="text-[1.02rem] font-medium tracking-[-0.03em] text-white/84 sm:text-[1.06rem]">
                      {formatCurrency(entry.grossAmount, entry.currencySnapshot)}
                    </p>
                    <ArrowRight className="h-5 w-5 text-white/28" />
                  </div>
                </div>
              </button>
            ))}

            <div className="p-4 sm:p-5">
              <Button
                variant="secondary"
                className="w-full justify-start gap-3 rounded-[999px] border border-white/[0.08] bg-white/[0.02] px-5 py-4 text-base font-medium text-white/88 shadow-none hover:bg-white/[0.04]"
                aria-label="Add entry for selected date"
                onClick={onAddEntry}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.02]">
                  <Plus className="h-5 w-5" />
                </div>
                Add entry for this day
              </Button>
            </div>
          </motion.div>
        ) : null}

        {!hasContent ? (
          <motion.div
            key={`empty-${title}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-between gap-4 rounded-[28px] border border-white/[0.045] bg-white/[0.02] px-5 py-5 shadow-[0_20px_50px_rgba(0,0,0,0.16)] backdrop-blur-[18px]"
          >
            <div className="space-y-1">
              <p className="text-base font-semibold text-white">No activity.</p>
              <p className="text-sm text-white/48">Add a shift.</p>
            </div>
            <Button
              className="gap-2 bg-white/[0.94] shadow-[0_16px_34px_rgba(0,0,0,0.24)]"
              onClick={onAddEntry}
            >
              <Plus className="h-4 w-4" />
              Add entry
            </Button>
          </motion.div>
        ) : null}

        {absence ? (
          <motion.div
            key={`absence-${absence.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[30px] border border-white/[0.045] bg-white/[0.022] px-5 py-5 shadow-[0_22px_50px_rgba(0,0,0,0.16)] backdrop-blur-[18px]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03]">
                  <MoonStar className="h-5 w-5 text-white/66" />
                </div>
                <div className="space-y-1">
                  <p className="text-[1.15rem] font-semibold tracking-[-0.04em] text-white">
                    {formatAbsenceType(absence.absenceType)}
                  </p>
                  <p className="text-sm text-white/56">
                    {formatShortDate(absence.startDate)} - {formatShortDate(absence.endDate)}
                  </p>
                  <p className="text-sm text-white/42">{countAbsenceDays(absence)} days</p>
                  {absence.notes ? (
                    <p className="pt-1 text-sm leading-6 text-white/58">{absence.notes}</p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-full border border-white/[0.05] bg-white/[0.04] px-4 py-2 text-sm text-white/68">
                {absenceStatus}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function resolveAbsenceStatus(absence: Absence | null) {
  if (!absence) {
    return "";
  }

  const today = new Date().toISOString().slice(0, 10);
  if (absence.startDate > today) {
    return "Upcoming";
  }
  if (absence.endDate < today) {
    return "Finished";
  }
  return "Approved";
}

function countAbsenceDays(absence: Absence) {
  const start = new Date(`${absence.startDate}T00:00:00`);
  const end = new Date(`${absence.endDate}T00:00:00`);
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short"
  }).format(date);
}
