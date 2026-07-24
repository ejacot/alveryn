import type { InputHTMLAttributes, ReactNode } from "react";
import { forwardRef, useId } from "react";
import { cn } from "../../utils/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  helperText?: string;
  label: string;
  wrapperClassName?: string;
  endAdornment?: ReactNode;
  compactDate?: boolean;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, compactDate = true, endAdornment, error, helperText, label, wrapperClassName, ...props },
  ref
) {
  const id = useId();
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const describedBy = [error ? errorId : null, helperText ? helperId : null]
    .filter(Boolean)
    .join(" ");
  const isCompactDateInput = props.type === "date" && compactDate;

  return (
    <div className={cn("block space-y-2", wrapperClassName)}>
      <label htmlFor={id} className="block text-sm font-medium text-white/78">{label}</label>
      <span className="relative block">
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          className={cn(
            "h-12 w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 text-base text-white outline-none transition placeholder:text-white/40 focus:border-white/[0.28] focus:bg-white/[0.09] focus:ring-2 focus:ring-white/24",
            endAdornment && "pr-16",
            isCompactDateInput && "mx-auto max-w-[15rem] appearance-none rounded-full text-center text-[0.95rem] font-semibold",
            error && "border-red-400/40 focus:border-red-400/40",
            className
          )}
          ref={ref}
          {...props}
        />
        {endAdornment ? (
          <span className="absolute inset-y-0 right-3 flex items-center">
            {endAdornment}
          </span>
        ) : null}
      </span>
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
    </div>
  );
});
