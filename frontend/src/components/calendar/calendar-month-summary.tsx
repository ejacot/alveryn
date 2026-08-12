import { useTranslation } from "react-i18next";
type Props = {
  workedHours: string;
  workGrossAmount: string;
  workedDays: number;
  absenceDays: number;
  restDays: number;
  classifiedDays: number;
  totalDays: number;
  absenceBreakdown: CalendarMonthSummaryBreakdownItem[];
  extraPayBreakdown: CalendarMonthSummaryBreakdownItem[];
};

export type CalendarMonthSummaryBreakdownItem = {
  id: string;
  label: string;
  hours: string;
  amount: string;
};

export function CalendarMonthSummary({
  workedHours,
  workGrossAmount,
  workedDays,
  absenceDays,
  restDays,
  classifiedDays,
  totalDays,
  absenceBreakdown,
  extraPayBreakdown
}: Props) {
  const { t } = useTranslation("calendar");

  return (
    <section
      className="calendar-month-summary relative overflow-hidden rounded-t-[30px] border border-b-0 border-[#10b981]/[0.16] bg-[linear-gradient(145deg,#151515_0%,#0b0c0b_52%,#101010_100%)] px-5 pb-5 pt-5 shadow-[0_30px_90px_rgba(0,0,0,0.38)]"
      aria-label={t("monthlySummaryLabel")}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#10b981]/[0.08] blur-3xl"
        aria-hidden="true"
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#10b981]/65">
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
            <p className="mt-2 break-words font-metric text-[clamp(2rem,10vw,2.65rem)] font-medium leading-none tracking-[-0.075em] tabular-nums text-[#f5f5f5]">
              {workGrossAmount}
            </p>
          </article>
          <article className="mt-5 flex items-end justify-between gap-4 border-t border-white/[0.07] pt-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/38">
              {t("monthlySummary.worked")}
            </p>
            <p className="whitespace-nowrap font-metric text-[1.65rem] font-medium leading-none tracking-[-0.06em] tabular-nums text-[#f5f5f5]">
              {workedHours}
            </p>
          </article>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-x-3 border-t border-white/[0.07] pt-4">
        <MiniMetric label={t("monthlySummary.workedDays")} value={String(workedDays)} align="left" />
        <MiniMetric label={t("monthlySummary.absenceDays")} value={String(absenceDays)} align="center" />
        <MiniMetric label={t("monthlySummary.restDays")} value={String(restDays)} align="right" />
      </div>

      {absenceBreakdown.length > 0 || extraPayBreakdown.length > 0 ? (
      <div className="relative mt-4 space-y-2 border-t border-white/[0.07] pt-4">
        {absenceBreakdown.map((item) => (
          <DetailMetric
            key={`absence:${item.id}`}
            label={item.label}
            value={item.hours}
            amount={item.amount}
          />
        ))}
        {extraPayBreakdown.map((item) => (
          <DetailMetric
            key={`extra:${item.id}`}
            label={item.label}
            value={item.hours}
            amount={item.amount}
          />
        ))}
      </div>
      ) : null}
    </section>
  );
}

function MiniMetric({
  label,
  value,
  align
}: {
  label: string;
  value: string;
  align: "left" | "center" | "right";
}) {
  return (
    <article className={align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"}>
      <p className="font-metric text-[1.25rem] font-medium tabular-nums text-[#f5f5f5]">
        {value}
      </p>
      <p className="mt-1 truncate text-[8px] font-medium uppercase tracking-[0.1em] text-white/32 sm:text-[9px]">
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
      <p className="truncate font-metric text-sm font-medium tabular-nums text-[#10b981]">{amount}</p>
    </article>
  );
}
