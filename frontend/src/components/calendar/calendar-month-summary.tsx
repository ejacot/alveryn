import { useTranslation } from "react-i18next";

type Props = {
  workedHours: string;
  grossAmount: string;
  workedDays: number;
  absenceDays: number;
};

export function CalendarMonthSummary({
  workedHours,
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
      <article className="space-y-2">
        <p className="hairline-text">{t("monthlySummary.worked")}</p>
        <p className="text-[3.2rem] font-semibold leading-none tracking-[-0.08em] text-white">
          {workedHours}
        </p>
      </article>

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
