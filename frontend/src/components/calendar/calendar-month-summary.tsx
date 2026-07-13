type Props = {
  workedHours: string;
  grossAmount: string;
  entriesCount: number;
  absenceDays: number;
};

export function CalendarMonthSummary({
  workedHours,
  grossAmount,
  entriesCount,
  absenceDays
}: Props) {
  return (
    <section className="space-y-4" aria-label="Monthly summary">
      <div className="space-y-1">
        <p className="hairline-text">Month summary</p>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
          <p className="text-[2rem] font-semibold tracking-[-0.07em] text-white">
            {workedHours}
          </p>
          <p className="text-lg font-medium tracking-[-0.03em] text-white/74">
            {grossAmount}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/52">
        <span>
          {entriesCount} entr{entriesCount === 1 ? "y" : "ies"}
        </span>
        <span>
          {absenceDays} absence day{absenceDays === 1 ? "" : "s"}
        </span>
      </div>
    </section>
  );
}
