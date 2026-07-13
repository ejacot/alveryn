import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../utils/cn";

type SettingsGroupProps = {
  title: string;
  children: React.ReactNode;
};

type SettingsRowProps = {
  to?: string;
  label: string;
  value?: string | null;
  destructive?: boolean;
  onClick?: () => void;
};

export function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <section className="space-y-3">
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/32">{title}</p>
      <div className="overflow-hidden rounded-[30px] border border-white/[0.05] bg-white/[0.035] backdrop-blur-sm">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  to,
  label,
  value,
  destructive = false,
  onClick
}: SettingsRowProps) {
  const classes =
    "flex min-h-16 w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-white/24 focus:ring-inset";

  const content = (
    <>
      <span
        className={cn(
          "text-[1rem] tracking-[-0.02em]",
          destructive ? "text-white" : "text-white"
        )}
      >
        {label}
      </span>
      <span className="flex items-center gap-3">
        {value ? <span className="text-sm text-white/48">{value}</span> : null}
        {to ? <ChevronRight className="h-4 w-4 text-white/24" aria-hidden="true" /> : null}
      </span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );
}
