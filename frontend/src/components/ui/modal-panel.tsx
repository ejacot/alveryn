import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cn } from "../../utils/cn";

type Props<T extends ElementType> = {
  as?: T;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className">;

/** The shared visual surface for every modal window in the application. */
export function ModalPanel<T extends ElementType = "div">({ as, className, ...props }: Props<T>) {
  const Component = as ?? "div";

  return (
    <Component
      className={cn(
        "relative z-10 w-full rounded-[32px] border border-white/[0.08] bg-[#090909]/95 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)]",
        className
      )}
      {...props}
    />
  );
}
