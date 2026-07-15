import type { InputHTMLAttributes } from "react";
import { forwardRef, useId } from "react";
import { cn } from "../../utils/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  helperText?: string;
  label: string;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, error, helperText, label, ...props },
  ref
) {
  const id = useId();
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const describedBy = [error ? errorId : null, helperText ? helperId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-white/78">{label}</span>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        className={cn(
          "h-12 w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 text-base text-white outline-none transition placeholder:text-white/40 focus:border-white/[0.28] focus:bg-white/[0.09] focus:ring-2 focus:ring-white/24",
          error && "border-red-400/40 focus:border-red-400/40",
          className
        )}
        ref={ref}
        {...props}
      />
      {error ? (
        <span id={errorId} className="text-xs text-red-300">
          {error}
        </span>
      ) : null}
      {helperText ? (
        <span id={helperId} className="block text-xs leading-5 text-white/42">
          {helperText}
        </span>
      ) : null}
    </label>
  );
});
