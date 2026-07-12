import type { TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "../../utils/cn";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string;
  label: string;
};

export function Textarea({ className, error, label, rows = 4, ...props }: Props) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-white/78">{label}</span>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-base text-white outline-none transition placeholder:text-white/40 focus:border-white/[0.28] focus:bg-white/[0.09] focus:ring-2 focus:ring-white/24",
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
