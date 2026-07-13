import { useTranslation } from "react-i18next";
import { formatCurrency, formatDisplayDate, formatMinutesAsDuration } from "../../utils/format";

type Props = {
  workTypeName: string;
  workDate: string;
  hourlyRate: string;
  currency: string;
  workedMinutes: number | null;
  grossAmount: number;
};

export function WorkEntrySummaryCard({
  workTypeName,
  workDate,
  hourlyRate,
  currency,
  workedMinutes,
  grossAmount
}: Props) {
  const { t } = useTranslation(["entries", "common"]);

  return (
    <section className="surface-muted space-y-5 px-5 py-5">
      <div>
        <p className="hairline-text">{t("entries:summary.eyebrow")}</p>
        <h2 className="mt-2 text-[1.2rem] font-semibold tracking-[-0.05em] text-white">
          {t("entries:summary.title")}
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SummaryItem
          label={t("entries:summary.workedHours")}
          value={formatMinutesAsDuration(workedMinutes ?? 0)}
        />
        <SummaryItem
          label={t("entries:summary.grossAmount")}
          value={formatCurrency(String(grossAmount), currency)}
        />
        <SummaryItem
          label={t("entries:summary.payRate")}
          value={formatCurrency(hourlyRate, currency)}
        />
        <SummaryItem
          label={t("entries:summary.date")}
          value={workDate ? formatDisplayDate(workDate) : t("common:time.today")}
        />
      </div>
      <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.03] px-4 py-3">
        <p className="hairline-text">{t("entries:summary.workType")}</p>
        <p className="mt-2 text-base font-medium text-white">{workTypeName}</p>
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.03] px-4 py-3">
      <p className="hairline-text">{label}</p>
      <p className="mt-2 text-base font-semibold tracking-[-0.03em] text-white">{value}</p>
    </div>
  );
}
