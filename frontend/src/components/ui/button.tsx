import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { cn } from "../../utils/cn";

type Props = HTMLMotionProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: Props) {
  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -1 }}
      type={type}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-[#050505] disabled:opacity-50",
        variant === "primary" &&
          "bg-white text-black shadow-soft hover:bg-white/90",
        variant === "secondary" &&
          "border border-white/[0.12] bg-white/[0.06] text-white hover:bg-white/[0.09]",
        variant === "ghost" && "bg-transparent text-white/72 hover:text-white",
        className
      )}
      {...props}
    />
  );
}
