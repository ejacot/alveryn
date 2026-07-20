import { ArrowLeft } from "lucide-react";
import { useSafeBackNavigation } from "../../hooks/use-safe-back-navigation";

type Props = {
  title: string;
  description?: string;
  fallbackHref?: string;
  onBack?: () => void;
};

export function SettingsPageHeader({
  title,
  description,
  fallbackHref = "/profile",
  onBack
}: Props) {
  const safeBack = useSafeBackNavigation({ fallback: fallbackHref });

  return (
    <header className="space-y-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onBack ?? safeBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.045] text-white/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:bg-white/[0.07] active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/24"
          aria-label="Go back"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>
        <h1 className="min-w-0 text-[1.75rem] font-semibold tracking-[-0.055em] text-white">{title}</h1>
      </div>
      {description ? (
        <div className="pl-[2.9rem]">
          <p className="max-w-[34rem] text-sm leading-6 text-white/48">{description}</p>
        </div>
      ) : null}
    </header>
  );
}
