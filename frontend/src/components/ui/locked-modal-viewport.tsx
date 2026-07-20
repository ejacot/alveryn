import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { useLockedVisualViewport } from "../../hooks/use-locked-visual-viewport";
import { cn } from "../../utils/cn";

type Props = ComponentPropsWithoutRef<"div">;

/** A fixed modal layer that stays centered in the usable viewport and locks the page behind it. */
export const LockedModalViewport = forwardRef<HTMLDivElement, Props>(function LockedModalViewport(
  { className, style, ...props },
  ref
) {
  const viewportStyle = useLockedVisualViewport(true);

  return (
    <div
      className={cn("fixed z-[80] flex items-center justify-center overflow-hidden overscroll-none", className)}
      ref={ref}
      style={{ ...viewportStyle, ...style }}
      {...props}
    />
  );
});
