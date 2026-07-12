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
        scale: compact ? 0.96 : 1,
        y: compact ? 8 : 0,
        paddingTop: compact ? 10 : 12,
        paddingBottom: compact ? 10 : 12
      }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="floating-nav glass-panel fixed inset-x-0 z-50 mx-auto flex w-[calc(100%-1.5rem)] max-w-[430px] items-center justify-between rounded-[32px] px-4"
    >
      {items.map(({ to, icon: Icon, label, prominent }) => (
        <NavLink
          key={to}
          to={to}
          aria-label={label}
          className="relative flex min-w-0 flex-1 justify-center"
        >
          {({ isActive }) => (
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full transition",
                prominent
                  ? "bg-white text-black shadow-soft"
                  : isActive
                    ? "bg-white/10 text-white"
                    : "text-white/58"
              )}
              title={label}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
          )}
        </NavLink>
      ))}
    </motion.nav>
  );
}
