import { useTranslation } from "react-i18next";
import { CardModuleTitle } from "../ui/card";

type Props = {
  workedHours: string;
  paidAbsenceHours: string;
  extraPaidHours: string;
  workGrossAmount: string;
  paidAbsenceGrossAmount: string;
  extraPaidGrossAmount: string;
  hasWorkedTime: boolean;
  workedDays: number;
  absenceDays: number;
  restDays: number;
  missingDays: number;
  classifiedDays: number;
  totalDays: number;
};

export function CalendarMonthSummary({
  workedHours,
  paidAbsenceHours,
  extraPaidHours,
  workGrossAmount,
  paidAbsenceGrossAmount,
  extraPaidGrossAmount,
  workedDays,
  absenceDays,
  restDays,
  missingDays,
  classifiedDays,
  totalDays
}: Props) {
  const { t } = useTranslation("calendar");

  return (
    <section
      className="px-1 py-2"
      aria-label={t("monthlySummaryLabel")}
    >
      <CardModuleTitle>{t("monthlySummaryLabel")}</CardModuleTitle>
      <div className="grid grid-cols-2 items-end gap-6 border-b border-white/[0.07] pb-4">
        <article className="min-w-0">
          <p className="hairline-text">{t("monthlySummary.worked")}</p>
          <p className="mt-1.5 truncate text-[2rem] font-semibold leading-none tracking-[-0.08em] text-white">
            {workedHours}
          </p>
        </article>
        <article className="min-w-0 text-right">
          <p className="hairline-text">{t("monthlySummary.grossPay")}</p>
          <p className="mt-1.5 truncate text-[2rem] font-semibold leading-none tracking-[-0.08em] text-white">
            {workGrossAmount}
          </p>
        </article>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 pt-4">
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
        {restDays > 0 ? (
          <article className="space-y-2">
            <p className="hairline-text">{t("monthlySummary.restDays")}</p>
            <p className="text-[1.55rem] font-semibold leading-none tracking-[-0.06em] text-white">
              {restDays}
            </p>
          </article>
        ) : null}
        {missingDays > 0 ? (
          <article className="space-y-2">
            <p className="hairline-text">{t("monthlySummary.missingDays")}</p>
            <p className="text-[1.55rem] font-semibold leading-none tracking-[-0.06em] text-amber-300">
              {missingDays}
            </p>
          </article>
        ) : null}
        <article className="space-y-2">
          <p className="hairline-text">{t("monthlySummary.classifiedDays")}</p>
          <p className="text-[1.55rem] font-semibold leading-none tracking-[-0.06em] text-white">
            {classifiedDays}/{totalDays}
          </p>
        </article>
        {paidAbsenceHours !== "0h 00m" ? (
          <article className="col-span-2 min-w-0 space-y-2 border-t border-white/[0.07] pt-4">
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
        {extraPaidHours !== "0h 00m" ? (
          <article className="col-span-2 min-w-0 space-y-2 border-t border-white/[0.07] pt-4">
            <p className="hairline-text">{t("monthlySummary.extraPay")}</p>
            <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
              <p className="text-[1.55rem] font-semibold leading-none tracking-[-0.06em] text-white">
                {extraPaidHours}
              </p>
              <p className="truncate text-[1.35rem] font-semibold leading-none tracking-[-0.06em] text-white/72">
                {extraPaidGrossAmount}
              </p>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
