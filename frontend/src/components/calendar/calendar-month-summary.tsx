import { useTranslation } from "react-i18next";

type Props = {
  workedHours: string;
  paidAbsenceHours: string;
  workGrossAmount: string;
  paidAbsenceGrossAmount: string;
  hasWorkedTime: boolean;
  workedDays: number;
  absenceDays: number;
};

export function CalendarMonthSummary({
  workedHours,
  paidAbsenceHours,
  workGrossAmount,
  paidAbsenceGrossAmount,
  hasWorkedTime,
  workedDays,
  absenceDays
}: Props) {
  const { t } = useTranslation("calendar");

  return (
    <section
      className="space-y-5"
      aria-label={t("monthlySummaryLabel")}
    >
      {hasWorkedTime ? (
        <article className="min-w-0 space-y-2">
          <p className="hairline-text">{t("monthlySummary.worked")}</p>
          <p className="truncate text-[3.2rem] font-semibold leading-none tracking-[-0.08em] text-white">
            {workedHours}
          </p>
        </article>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(3.75rem,0.85fr)_minmax(4.5rem,0.9fr)] gap-x-4 gap-y-5 sm:gap-x-6">
        <article className="min-w-0 space-y-2">
          <p className="hairline-text">{t("monthlySummary.grossPay")}</p>
          <p className="truncate text-[1.55rem] font-semibold leading-none tracking-[-0.06em] text-white">
            {workGrossAmount}
          </p>
        </article>
        <article className="space-y-2">
          <p className="hairline-text">{t("monthlySummary.workedDays")}</p>
          <p className="text-[1.55rem] font-semibold leading-none tracking-[-0.06em] text-white">
            {workedDays}
          </p>
        </article>
        {absenceDays > 0 ? (
          <article className="space-y-2">
            <p className="hairline-text">{t("monthlySummary.absenceDays")}</p>
            <p className="text-[1.55rem] font-semibold leading-none tracking-[-0.06em] text-white">
              {absenceDays}
            </p>
          </article>
        ) : null}
        {paidAbsenceHours !== "0h 00m" ? (
          <article className="col-span-3 min-w-0 space-y-2">
            <p className="hairline-text">{t("monthlySummary.paidAbsence")}</p>
            <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
              <p className="text-[1.55rem] font-semibold leading-none tracking-[-0.06em] text-white">
                {paidAbsenceHours}
              </p>
              <p className="truncate text-[1.35rem] font-semibold leading-none tracking-[-0.06em] text-white/72">
                {paidAbsenceGrossAmount}
              </p>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
