import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "../../utils/cn";

export type CardVariant = "glass" | "section" | "muted" | "panel" | "auth";

const variantClassNames: Record<CardVariant, string> = {
  glass: "",
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
