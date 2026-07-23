import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../utils/cn";
import { Card } from "../ui/card";

type SettingsGroupProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

type SettingsRowProps = {
  to?: string;
  label: string;
  description?: string;
  value?: string | null;
  destructive?: boolean;
  onClick?: () => void;
  showChevron?: boolean;
};

export function SettingsGroup({ title, description, children }: SettingsGroupProps) {
  return (
    <section className="space-y-2">
      <div className="space-y-1">
        <p className="hairline-text">{title}</p>
        {description ? <p className="text-sm leading-5 text-white/42">{description}</p> : null}
      </div>
      <Card className="overflow-hidden">
        {children}
      </Card>
    </section>
  );
}

export function SettingsRow({
  to,
  label,
  description,
  value,
  destructive = false,
  onClick,
  showChevron
}: SettingsRowProps) {
  const classes =
    "flex min-h-14 w-full items-center justify-between gap-4 px-5 py-3 text-left transition hover:bg-white/[0.055] focus:outline-none focus:ring-2 focus:ring-white/24 focus:ring-inset";

  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[1rem] tracking-[-0.02em]",
            destructive ? "text-white" : "text-white"
          )}
        >
          {label}
        </span>
        {description ? <span className="mt-1 block text-xs leading-5 text-white/42">{description}</span> : null}
      </span>
      <span className="flex items-center gap-3">
        {value ? <span className="text-sm text-white/48">{value}</span> : null}
        {to || showChevron ? <ChevronRight className="h-4 w-4 text-white/24" aria-hidden="true" /> : null}
      </span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={label}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes} aria-label={label}>
      {content}
    </button>
  );
}
