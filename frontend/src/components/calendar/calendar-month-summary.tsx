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
    <section
      className="grid grid-cols-2 gap-x-5 gap-y-5 border-y border-white/[0.05] py-4 md:grid-cols-4"
      aria-label="Monthly summary"
    >
      <div className="space-y-1">
        <p className="text-[1.8rem] font-semibold tracking-[-0.07em] text-white">{workedHours}</p>
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/34">Worked</p>
      </div>
      <div className="space-y-1">
        <p className="text-[1.8rem] font-semibold tracking-[-0.07em] text-white">{grossAmount}</p>
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/34">Gross</p>
      </div>
      <div className="space-y-1">
        <p className="text-[1.8rem] font-semibold tracking-[-0.07em] text-white">
          {entriesCount}
        </p>
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/34">
          Entr{entriesCount === 1 ? "y" : "ies"}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-[1.8rem] font-semibold tracking-[-0.07em] text-white">
          {absenceDays}
        </p>
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/34">
          Absence{absenceDays === 1 ? "" : "s"}
        </p>
      </div>
    </section>
  );
}
