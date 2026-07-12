import type { InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  label: string;
};

export function Input({ className, error, label, ...props }: Props) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-white/78">{label}</span>
      <input
        className={cn(
          "h-12 w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-white/[0.28] focus:bg-white/[0.09]",
          error && "border-red-400/40 focus:border-red-400/40",
          className
        )}
        {...props}
      />
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
    </label>
  );
}
