import { ArrowRight, BriefcaseBusiness, CalendarDays, MoonStar, Plus } from "lucide-react";
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

  return (
    <section className="space-y-5" aria-label="Selected day details">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/34">{titleEyebrow}</p>
        <p className="text-[1.55rem] font-semibold tracking-[-0.06em] text-white">{title}</p>
      </div>

      {absence ? (
        <article className="rounded-[30px] border border-white/[0.04] bg-white/[0.02] px-5 py-5 shadow-[0_22px_50px_rgba(0,0,0,0.16)] backdrop-blur-[18px]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03]">
                <MoonStar className="h-5 w-5 text-white/66" />
              </div>
              <div className="space-y-1.5">
                <p className="text-[1.15rem] font-semibold tracking-[-0.04em] text-white">
                  {formatAbsenceType(absence.absenceType)}
                </p>
                <p className="text-sm text-white/52">
                  {absence.startDate} - {absence.endDate}
                </p>
                {absence.notes ? (
                  <p className="pt-1 text-sm leading-6 text-white/58">{absence.notes}</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-full border border-white/[0.05] bg-white/[0.04] px-4 py-2 text-sm text-white/68">
              Upcoming
            </div>
          </div>
        </article>
      ) : null}

      {entries.length ? (
        <div className="overflow-hidden rounded-[30px] border border-white/[0.04] bg-white/[0.02] shadow-[0_22px_50px_rgba(0,0,0,0.16)] backdrop-blur-[18px]">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onEntrySelect(entry.id)}
              className="w-full border-b border-white/[0.04] px-5 py-5 text-left transition hover:bg-white/[0.02] focus:outline-none focus:ring-2 focus:ring-white/24 focus:ring-inset"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03]">
                    <CalendarDays className="h-5 w-5 text-white/66" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[1.15rem] font-semibold tracking-[-0.04em] text-white">
                      {entry.workTypeName}
                    </p>
                    <p className="text-[1.05rem] tracking-[-0.03em] text-white/72">
                      {formatTimeRange(entry.timeEntry?.startTime, entry.timeEntry?.endTime) ??
                        `${entry.unitItems.length} unit row${entry.unitItems.length === 1 ? "" : "s"}`}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-white/48">
                      <span>{formatMinutesAsDuration(Number(entry.calculatedMinutes))}</span>
                      <span className="h-1 w-1 rounded-full bg-white/16" aria-hidden="true" />
                      <span>{formatCurrency(entry.grossAmount, entry.currencySnapshot)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-3">
                  <p className="text-[1.05rem] font-medium tracking-[-0.03em] text-white/80">
                    {formatCurrency(entry.grossAmount, entry.currencySnapshot)}
                  </p>
                  <ArrowRight className="h-5 w-5 text-white/32" />
                </div>
              </div>
            </button>
          ))}

          <div className="p-4">
            <Button
              variant="secondary"
              className="w-full justify-start gap-3 rounded-[24px] border-white/[0.08] bg-white/[0.02] px-5 py-4 text-base font-medium text-white/88 shadow-none hover:bg-white/[0.04]"
              aria-label="Add entry for selected date"
              onClick={onAddEntry}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.02]">
                <Plus className="h-5 w-5" />
              </div>
              Add entry for this day
            </Button>
          </div>
        </div>
      ) : null}

      {!hasContent ? (
        <div className="flex items-center justify-between gap-4 rounded-[28px] border border-white/[0.04] bg-white/[0.02] px-5 py-5 shadow-[0_20px_50px_rgba(0,0,0,0.16)] backdrop-blur-[18px]">
          <div className="space-y-1">
            <p className="text-base font-semibold text-white">No activity.</p>
            <p className="text-sm text-white/48">Add a shift.</p>
          </div>
          <Button className="gap-2 bg-white/[0.94] shadow-[0_16px_34px_rgba(0,0,0,0.24)]" onClick={onAddEntry}>
            <BriefcaseBusiness className="h-4 w-4" />
            Add entry
          </Button>
        </div>
      ) : null}
    </section>
  );
}
