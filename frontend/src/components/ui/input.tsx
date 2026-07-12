import type { InputHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "../../utils/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  label: string;
};

export function Input({ className, error, label, ...props }: Props) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-white/78">{label}</span>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "h-12 w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 text-base text-white outline-none transition placeholder:text-white/40 focus:border-white/[0.28] focus:bg-white/[0.09] focus:ring-2 focus:ring-white/24",
          error && "border-red-400/40 focus:border-red-400/40",
          className
        )}
        {...props}
      />
      {error ? (
        <span id={errorId} className="text-xs text-red-300">
          {error}
        </span>
      ) : null}
    </label>
  );
}
