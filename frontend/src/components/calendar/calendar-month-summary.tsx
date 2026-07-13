import { BriefcaseBusiness, CalendarDays, CircleDollarSign, Clock3 } from "lucide-react";

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
      className="grid grid-cols-2 gap-0 overflow-hidden rounded-[30px] border border-white/[0.04] bg-white/[0.02] shadow-[0_20px_50px_rgba(0,0,0,0.16)] backdrop-blur-[18px] md:grid-cols-4"
      aria-label="Monthly summary"
    >
      <div className="flex items-center gap-3 px-4 py-5 md:px-5">
        <Clock3 className="h-5 w-5 text-white/44" strokeWidth={2} />
        <div className="space-y-1">
          <p className="text-[1.75rem] font-semibold tracking-[-0.07em] text-white">{workedHours}</p>
          <p className="text-[11px] tracking-[-0.01em] text-white/44">Worked</p>
        </div>
      </div>
      <div className="flex items-center gap-3 border-l border-white/[0.04] px-4 py-5 md:px-5">
        <CircleDollarSign className="h-5 w-5 text-white/44" strokeWidth={2} />
        <div className="space-y-1">
          <p className="text-[1.75rem] font-semibold tracking-[-0.07em] text-white">{grossAmount}</p>
          <p className="text-[11px] tracking-[-0.01em] text-white/44">Gross pay</p>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-white/[0.04] px-4 py-5 md:border-l md:border-t-0 md:px-5">
        <BriefcaseBusiness className="h-5 w-5 text-white/44" strokeWidth={2} />
        <div className="space-y-1">
          <p className="text-[1.75rem] font-semibold tracking-[-0.07em] text-white">
            {entriesCount}
          </p>
          <p className="text-[11px] tracking-[-0.01em] text-white/44">
            Entr{entriesCount === 1 ? "y" : "ies"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 border-l border-t border-white/[0.04] px-4 py-5 md:px-5 md:border-t-0">
        <CalendarDays className="h-5 w-5 text-white/44" strokeWidth={2} />
        <div className="space-y-1">
          <p className="text-[1.75rem] font-semibold tracking-[-0.07em] text-white">
            {absenceDays}
          </p>
          <p className="text-[11px] tracking-[-0.01em] text-white/44">
            Absence day{absenceDays === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </section>
  );
}
