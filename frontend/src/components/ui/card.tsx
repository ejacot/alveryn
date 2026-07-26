import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "../../utils/cn";

export type CardVariant = "glass" | "ambient" | "section" | "muted" | "panel" | "auth";

const variantClassNames: Record<CardVariant, string> = {
  glass: "",
  ambient: "glass-card--ambient",
  section: "p-5",
  muted: "rounded-[24px]",
  panel: "",
  auth: "relative overflow-hidden rounded-[32px]"
};

type CardOwnProps<T extends ElementType> = {
  as?: T;
  children?: ReactNode;
  className?: string;
  variant?: CardVariant;
};

export type CardProps<T extends ElementType = "div"> = CardOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof CardOwnProps<T>>;

/**
 * The single visual surface used throughout the application.
 * `as` preserves the semantic element (section, article, button, Link, motion.div, etc.).
 */
export function Card<T extends ElementType = "div">({
  as,
  className,
  variant = "glass",
  ...props
}: CardProps<T>) {
  const Component = as ?? "div";

  return (
    <Component
      className={cn("universal-glass-card", variantClassNames[variant], className)}
      {...props}
    />
  );
}

type CardModuleTitleProps = ComponentPropsWithoutRef<"p">;

/**
 * Shared title treatment for content modules. Keep action/list surfaces titleless.
 */
export function CardModuleTitle({ className, ...props }: CardModuleTitleProps) {
  return (
    <p
      className={cn(
        "hairline-text mb-4 text-center",
        className
      )}
      {...props}
    />
  );
}
