import { motion } from "framer-motion";
import {
  CalendarDays,
  CircleUserRound,
  House,
  Plus,
  ChartColumnIncreasing
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useScrollDirection } from "../../hooks/use-scroll-direction";
import { cn } from "../../utils/cn";

type NavItem = {
  to: string;
  icon: typeof House;
  label: string;
  prominent?: boolean;
};

const items: NavItem[] = [
  { to: "/", icon: House, label: "Home" },
  { to: "/calendar", icon: CalendarDays, label: "Calendar" },
  { to: "/entries/new", icon: Plus, label: "Add Entry", prominent: true },
  { to: "/statistics", icon: ChartColumnIncreasing, label: "Statistics" },
  { to: "/profile", icon: CircleUserRound, label: "Profile" }
];

export function BottomNav() {
  const direction = useScrollDirection();
  const compact = direction === "down";

  return (
    <motion.nav
      aria-label="Primary navigation"
      animate={{
        scale: compact ? 0.82 : 1,
        y: compact ? 10 : 0,
        width: compact ? "calc(100% - 4.25rem)" : "calc(100% - 1.5rem)",
        paddingTop: compact ? 8 : 12,
        paddingBottom: compact ? 8 : 12
      }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="floating-nav ios-glass-nav fixed inset-x-0 z-50 mx-auto flex max-w-[430px] items-center justify-between rounded-[34px] px-3"
    >
      {items.map(({ to, icon: Icon, label, prominent }) => (
        <NavLink
          key={to}
          to={to}
          aria-label={label}
          className="relative flex min-w-0 flex-1 justify-center"
        >
          {({ isActive }) => (
            <motion.div
              animate={{
                scale: prominent ? 1 : isActive ? 1.1 : 1,
                opacity: isActive || prominent ? 1 : 0.52
              }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className={cn(
                "flex items-center justify-center transition",
                prominent
                  ? "h-12 w-12 rounded-full border border-white/[0.08] bg-white/[0.9] text-black shadow-[0_18px_40px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.28)]"
                  : "h-11 w-11 text-white/52"
              )}
              title={label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn(
                  prominent ? "h-5 w-5" : isActive ? "h-[22px] w-[22px] text-white" : "h-5 w-5"
                )}
                strokeWidth={prominent ? 2.4 : isActive ? 2.5 : 2.1}
                aria-hidden="true"
              />
            </motion.div>
          )}
        </NavLink>
      ))}
    </motion.nav>
  );
}
