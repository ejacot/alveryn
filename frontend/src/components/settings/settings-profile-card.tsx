import { ChevronRight, ChevronsUpDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../ui/card";

type Props = {
  initials: string;
  fullName: string;
  email: string;
  ariaLabel: string;
  employmentLabel: string;
  employmentValue?: string | null;
  employmentOptions: Array<{ id: string; name: string }>;
  selectedEmploymentId: string | null;
  allEmploymentsLabel: string;
  chooseEmploymentLabel: string;
  onEmploymentChange: (employmentId: string | null) => void;
};

export function SettingsProfileCard({
  initials,
  fullName,
  email,
  ariaLabel,
  employmentLabel,
  employmentValue,
  employmentOptions,
  selectedEmploymentId,
  allEmploymentsLabel,
  chooseEmploymentLabel,
  onEmploymentChange
}: Props) {
  return (
    <Card className="overflow-hidden">
      <Link
        to="/settings/profile"
        aria-label={ariaLabel}
        className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24 focus:ring-inset"
      >
        <div className="font-name flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.08] text-[1rem] font-semibold tracking-[-0.04em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-name truncate text-[1.05rem] font-semibold tracking-[-0.04em] text-white">{fullName}</p>
          <p className="mt-1 truncate text-sm text-white/50">{email}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/24" aria-hidden="true" />
      </Link>
      <div className="mx-5 h-px bg-white/[0.07]" />
      <div className="flex min-h-14 items-center justify-between gap-4 px-5">
        <Link
          to="/settings/employment"
          aria-label={`${employmentLabel} ${employmentValue ?? ""}`.trim()}
          className="min-w-0 flex-1 py-3 text-[1rem] tracking-[-0.02em] text-white transition hover:text-white/72 focus:outline-none focus:ring-2 focus:ring-white/24"
        >
          {employmentLabel}
        </Link>
        {employmentOptions.length > 1 ? (
          <span className="flex min-w-0 max-w-[13rem] items-center gap-2">
            <select
              aria-label={chooseEmploymentLabel}
              value={selectedEmploymentId ?? ""}
              onChange={(event) => onEmploymentChange(event.currentTarget.value || null)}
              className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent py-2 text-right text-sm text-white/58 outline-none focus:ring-2 focus:ring-white/24"
            >
              <option value="">{allEmploymentsLabel}</option>
              {employmentOptions.map((employment) => (
                <option key={employment.id} value={employment.id}>{employment.name}</option>
              ))}
            </select>
            <ChevronsUpDown className="pointer-events-none h-4 w-4 shrink-0 text-white/24" aria-hidden="true" />
          </span>
        ) : (
          <span className="flex items-center gap-3">
            {employmentValue ? <span className="max-w-[12rem] truncate text-sm text-white/48">{employmentValue}</span> : null}
            <ChevronRight className="h-4 w-4 shrink-0 text-white/24" aria-hidden="true" />
          </span>
        )}
      </div>
    </Card>
  );
}
