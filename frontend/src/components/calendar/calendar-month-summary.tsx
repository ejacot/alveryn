import { useTranslation } from "react-i18next";
type Props = {
  workedHours: string;
  paidAbsenceHours: string;
  extraPaidHours: string;
  workGrossAmount: string;
  paidAbsenceGrossAmount: string;
  extraPaidGrossAmount: string;
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
      className="calendar-month-summary relative overflow-hidden rounded-t-[30px] border border-b-0 border-[#d5be8d]/[0.16] bg-[linear-gradient(145deg,#151510_0%,#0b0c0b_52%,#10100d_100%)] px-5 pb-5 pt-5 shadow-[0_30px_90px_rgba(0,0,0,0.38)]"
      aria-label={t("monthlySummaryLabel")}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#d5be8d]/[0.08] blur-3xl"
        aria-hidden="true"
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#d5be8d]/65">
            {t("monthlySummaryLabel")}
          </p>
          <p className="text-[10px] font-medium tabular-nums text-white/38">
            {classifiedDays}/{totalDays} {t("monthlySummary.classifiedDays").toLocaleLowerCase()}
          </p>
        </div>

        <div className="mt-5">
          <article>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/38">
              {t("monthlySummary.grossPay")}
            </p>
            <p className="mt-2 break-words font-metric text-[clamp(2rem,10vw,2.65rem)] font-medium leading-none tracking-[-0.075em] tabular-nums text-[#f4f0e7]">
              {workGrossAmount}
            </p>
          </article>
          <article className="mt-5 flex items-end justify-between gap-4 border-t border-white/[0.07] pt-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/38">
              {t("monthlySummary.worked")}
            </p>
            <p className="whitespace-nowrap font-metric text-[1.65rem] font-medium leading-none tracking-[-0.06em] tabular-nums text-[#f4f0e7]">
              {workedHours}
            </p>
          </article>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-white/[0.07] pt-4">
        <MiniMetric label={t("monthlySummary.workedDays")} value={String(workedDays)} />
        <MiniMetric label={t("monthlySummary.absenceDays")} value={String(absenceDays)} />
        <MiniMetric label={t("monthlySummary.restDays")} value={String(restDays)} />
        <MiniMetric label={t("monthlySummary.missingDays")} value={String(missingDays)} accent={missingDays > 0} />
      </div>

      {paidAbsenceHours !== "0h 00m" || extraPaidHours !== "0h 00m" ? (
      <div className="relative mt-4 space-y-2 border-t border-white/[0.07] pt-4">
        {paidAbsenceHours !== "0h 00m" ? (
          <DetailMetric
            label={t("monthlySummary.paidAbsence")}
            value={paidAbsenceHours}
            amount={paidAbsenceGrossAmount}
          />
        ) : null}
        {extraPaidHours !== "0h 00m" ? (
          <DetailMetric
            label={t("monthlySummary.extraPay")}
            value={extraPaidHours}
            amount={extraPaidGrossAmount}
          />
        ) : null}
      </div>
      ) : null}
    </section>
  );
}

function MiniMetric({
  label,
  value,
  accent = false
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <article>
      <p className={accent
        ? "font-metric text-[1.25rem] font-medium tabular-nums text-[#d5be8d]"
        : "font-metric text-[1.25rem] font-medium tabular-nums text-[#f4f0e7]"
      }>
        {value}
      </p>
      <p className="mt-1 truncate text-[9px] font-medium uppercase tracking-[0.12em] text-white/32">
        {label}
      </p>
    </article>
  );
}

function DetailMetric({
  label,
  value,
  amount
}: {
  label: string;
  value: string;
  amount: string;
}) {
  return (
    <article className="flex items-center justify-between gap-4 rounded-2xl bg-white/[0.035] px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/34">{label}</p>
        <p className="mt-1 font-metric text-sm font-medium tabular-nums text-white/72">{value}</p>
      </div>
      <p className="truncate font-metric text-sm font-medium tabular-nums text-[#d5be8d]">{amount}</p>
    </article>
  );
}
