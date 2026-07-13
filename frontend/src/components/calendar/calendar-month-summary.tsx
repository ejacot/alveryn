import { BriefcaseBusiness, CalendarDays, CircleDollarSign, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("calendar");

  return (
    <section
      className="grid grid-cols-4 overflow-hidden rounded-[32px] border border-white/[0.045] bg-white/[0.025] shadow-[0_20px_54px_rgba(0,0,0,0.16)] backdrop-blur-[20px]"
      aria-label={t("monthlySummaryLabel")}
    >
      <div className="flex flex-col items-center justify-center gap-2 px-3 py-5 text-center sm:py-6">
        <Clock3 className="h-5 w-5 text-white/36" strokeWidth={1.9} />
        <div className="space-y-1">
          <p className="text-[1.12rem] font-semibold tracking-[-0.05em] text-white md:text-[1.72rem]">
            {workedHours}
          </p>
          <p className="text-[10px] tracking-[-0.01em] text-white/44 md:text-[11px]">{t("monthlySummary.worked")}</p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 border-l border-white/[0.045] px-3 py-5 text-center sm:py-6">
        <CircleDollarSign className="h-5 w-5 text-white/36" strokeWidth={1.9} />
        <div className="space-y-1">
          <p className="text-[1.12rem] font-semibold tracking-[-0.05em] text-white md:text-[1.72rem]">
            {grossAmount}
          </p>
          <p className="text-[10px] tracking-[-0.01em] text-white/44 md:text-[11px]">{t("monthlySummary.grossPay")}</p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 border-l border-white/[0.045] px-3 py-5 text-center sm:py-6">
        <BriefcaseBusiness className="h-5 w-5 text-white/36" strokeWidth={1.9} />
        <div className="space-y-1">
          <p className="text-[1.12rem] font-semibold tracking-[-0.05em] text-white md:text-[1.72rem]">
            {entriesCount}
          </p>
          <p className="text-[10px] tracking-[-0.01em] text-white/44 md:text-[11px]">
            {t("monthlySummary.entries")}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 border-l border-white/[0.045] px-3 py-5 text-center sm:py-6">
        <CalendarDays className="h-5 w-5 text-white/36" strokeWidth={1.9} />
        <div className="space-y-1">
          <p className="text-[1.12rem] font-semibold tracking-[-0.05em] text-white md:text-[1.72rem]">
            {absenceDays}
          </p>
          <p className="text-[10px] tracking-[-0.01em] text-white/44 md:text-[11px]">
            {t("monthlySummary.absenceDays")}
          </p>
        </div>
      </div>
    </section>
  );
}
