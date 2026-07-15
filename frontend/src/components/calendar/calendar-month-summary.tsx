import { useTranslation } from "react-i18next";

type Props = {
  workedHours: string;
  paidTotalHours: string;
  paidAbsenceHours: string;
  grossAmount: string;
  workedDays: number;
  absenceDays: number;
};

export function CalendarMonthSummary({
  workedHours,
  paidTotalHours,
  paidAbsenceHours,
  grossAmount,
  workedDays,
  absenceDays
}: Props) {
  const { t } = useTranslation("calendar");

  return (
    <section
      className="space-y-5"
      aria-label={t("monthlySummaryLabel")}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-5">
        <article className="min-w-0 space-y-2">
          <p className="hairline-text">{t("monthlySummary.worked")}</p>
          <p className="truncate text-[3.2rem] font-semibold leading-none tracking-[-0.08em] text-white">
            {workedHours}
          </p>
        </article>
	        <article className="min-w-[5.6rem] space-y-2 pb-1 text-right">
	          <p className="hairline-text">{t("monthlySummary.paidAbsence")}</p>
	          <p className="text-[1.35rem] font-semibold leading-none tracking-[-0.06em] text-white">
	            {paidTotalHours}
	          </p>
	          <div className="space-y-1 text-xs font-medium text-white/42">
	            {paidAbsenceHours !== "0h 00m" ? (
	              <p>{t("monthlySummary.paidAbsenceDetail", { duration: paidAbsenceHours })}</p>
	            ) : null}
	          </div>
	        </article>
      </div>

      <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(3.75rem,0.85fr)_minmax(4.5rem,0.9fr)] gap-x-6">
        <article className="min-w-0 space-y-2">
          <p className="hairline-text">{t("monthlySummary.grossPay")}</p>
          <p className="truncate text-[1.55rem] font-semibold leading-none tracking-[-0.06em] text-white">
            {grossAmount}
          </p>
        </article>
        <article className="space-y-2">
          <p className="hairline-text">{t("monthlySummary.workedDays")}</p>
          <p className="text-[1.55rem] font-semibold leading-none tracking-[-0.06em] text-white">
            {workedDays}
          </p>
        </article>
        <article className="space-y-2">
          <p className="hairline-text">{t("monthlySummary.absenceDays")}</p>
          <p className="text-[1.55rem] font-semibold leading-none tracking-[-0.06em] text-white">
            {absenceDays}
          </p>
        </article>
      </div>
    </section>
  );
}
