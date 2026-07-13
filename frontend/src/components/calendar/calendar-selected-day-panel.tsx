import { BriefcaseBusiness, MoonStar, Plus } from "lucide-react";
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

  return (
    <section className="space-y-5" aria-label="Selected day details">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-[1.65rem] font-semibold tracking-[-0.06em] text-white">
            {title}
          </p>
          <p className="text-sm text-white/42">Everything saved for this day.</p>
        </div>
        <Button
          className="gap-2 bg-white/[0.96] shadow-[0_16px_34px_rgba(0,0,0,0.26)]"
          aria-label="Add entry for selected date"
          onClick={onAddEntry}
        >
          <Plus className="h-4 w-4" />
          Add entry
        </Button>
      </div>

      {absence ? (
        <article className="rounded-[26px] border border-white/[0.04] bg-white/[0.022] px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.14)] backdrop-blur-[18px]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.05] bg-white/[0.03]">
              <MoonStar className="h-4 w-4 text-white/62" />
            </div>
            <div className="space-y-1.5">
              <p className="text-[1.05rem] font-semibold tracking-[-0.03em] text-white">
                {formatAbsenceType(absence.absenceType)}
              </p>
              <p className="text-sm text-white/46">
                {absence.startDate} - {absence.endDate}
              </p>
              {absence.notes ? (
                <p className="pt-1 text-sm leading-6 text-white/58">{absence.notes}</p>
              ) : null}
            </div>
          </div>
        </article>
      ) : null}

      {entries.length ? (
        <div className="space-y-3">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onEntrySelect(entry.id)}
              className="w-full rounded-[26px] border border-white/[0.04] bg-white/[0.022] px-5 py-5 text-left shadow-[0_18px_40px_rgba(0,0,0,0.14)] backdrop-blur-[18px] transition hover:bg-white/[0.026] focus:outline-none focus:ring-2 focus:ring-white/24 focus:ring-offset-2 focus:ring-offset-[#050505]"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/30">
                      {entry.workTypeName}
                    </p>
                    <p className="text-[1.6rem] font-semibold tracking-[-0.07em] text-white">
                      {formatTimeRange(entry.timeEntry?.startTime, entry.timeEntry?.endTime) ??
                        `${entry.unitItems.length} unit row${entry.unitItems.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.05] bg-white/[0.03]">
                    <BriefcaseBusiness className="h-4 w-4 text-white/54" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="text-white/68">
                    {formatMinutesAsDuration(Number(entry.calculatedMinutes))}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-white/18" aria-hidden="true" />
                  <span className="text-white/46">
                    {formatCurrency(entry.grossAmount, entry.currencySnapshot)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {!hasContent ? (
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] pb-4">
          <div className="space-y-1">
            <p className="text-base font-semibold text-white">No activity.</p>
            <p className="text-sm text-white/48">Add a shift.</p>
          </div>
          <Button className="gap-2" onClick={onAddEntry}>
            <Plus className="h-4 w-4" />
            Add entry
          </Button>
        </div>
      ) : null}
    </section>
  );
}
