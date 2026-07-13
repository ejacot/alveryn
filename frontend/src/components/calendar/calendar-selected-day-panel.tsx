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
    <section className="space-y-4" aria-label="Selected day details">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="hairline-text">Selected day</p>
          <h2 className="text-[1.5rem] font-semibold tracking-[-0.05em] text-white">
            {title}
          </h2>
        </div>
        <Button
          className="gap-2"
          aria-label="Add entry for selected date"
          onClick={onAddEntry}
        >
          <Plus className="h-4 w-4" />
          Add entry
        </Button>
      </div>

      {absence ? (
        <article className="surface-muted p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035]">
              <MoonStar className="h-4 w-4 text-white/74" />
            </div>
            <div className="space-y-2">
              <p className="text-base font-semibold text-white">
                {formatAbsenceType(absence.absenceType)}
              </p>
              <p className="text-sm text-white/56">
                {absence.startDate} - {absence.endDate}
              </p>
              {absence.notes ? (
                <p className="text-sm leading-6 text-white/62">{absence.notes}</p>
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
              className="surface-muted w-full p-5 text-left focus:outline-none focus:ring-2 focus:ring-white/28 focus:ring-offset-2 focus:ring-offset-[#050505]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035]">
                      <BriefcaseBusiness className="h-4 w-4 text-white/72" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white">
                        {entry.workTypeName}
                      </p>
                      <p className="text-sm text-white/54">
                        {formatTimeRange(entry.timeEntry?.startTime, entry.timeEntry?.endTime) ??
                          `${entry.unitItems.length} unit row${entry.unitItems.length === 1 ? "" : "s"}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/66">
                    <span>{formatMinutesAsDuration(Number(entry.calculatedMinutes))}</span>
                    <span>{formatCurrency(entry.grossAmount, entry.currencySnapshot)}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {!hasContent ? (
        <div className="surface-muted px-5 py-8 text-center">
          <p className="text-base font-semibold text-white">No activity.</p>
          <p className="mt-2 text-sm leading-6 text-white/56">Add a shift.</p>
        </div>
      ) : null}
    </section>
  );
}
