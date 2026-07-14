import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
  initials: string;
  fullName: string;
  email: string;
  ariaLabel: string;
};

export function SettingsProfileCard({ initials, fullName, email, ariaLabel }: Props) {
  return (
    <Link
      to="/settings/profile"
      aria-label={ariaLabel}
      className="flex items-center gap-4 rounded-[32px] border border-white/[0.05] bg-white/[0.04] px-5 py-5 transition hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-white/24"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.06] text-[1.1rem] font-semibold tracking-[-0.04em] text-white">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[1.15rem] font-semibold tracking-[-0.05em] text-white">
          {fullName}
        </p>
        <p className="mt-1 truncate text-sm text-white/50">{email}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/24" aria-hidden="true" />
    </Link>
  );
}
