import { formatCurrency, formatMinutesAsDuration } from "../../utils/format";

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
  return (
    <section className="section-card space-y-4 bg-white/[0.085]">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/52">Summary</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Ready to save</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SummaryItem
          label="Worked Hours"
          value={formatMinutesAsDuration(workedMinutes ?? 0)}
        />
        <SummaryItem label="Gross Amount" value={formatCurrency(String(grossAmount), currency)} />
        <SummaryItem label="Hourly Rate" value={formatCurrency(hourlyRate, currency)} />
        <SummaryItem label="Date" value={workDate || "Today"} />
      </div>
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3">
        <p className="text-xs uppercase tracking-[0.22em] text-white/42">Work Type</p>
        <p className="mt-2 text-base font-medium text-white">{workTypeName}</p>
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.22em] text-white/42">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}
