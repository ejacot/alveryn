import { motion } from "framer-motion";
import {
  CalendarDays,
  ChartColumnIncreasing,
  CircleUserRound,
  House,
  Plus
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { useScrollDirection } from "../../hooks/use-scroll-direction";
import { cn } from "../../utils/cn";

type NavItem = {
  to: string;
  icon: typeof House;
  label: string;
  prominent?: boolean;
};

export function BottomNav() {
  const { t } = useTranslation("common");
  const direction = useScrollDirection();
  const compact = direction === "down";
  const items: NavItem[] = [
    { to: "/", icon: House, label: t("nav.home") },
    { to: "/calendar", icon: CalendarDays, label: t("nav.calendar") },
    { to: "/entries/new", icon: Plus, label: t("nav.addEntry"), prominent: true },
    { to: "/statistics", icon: ChartColumnIncreasing, label: t("nav.statistics") },
    { to: "/profile", icon: CircleUserRound, label: t("nav.settings") }
  ];

  return (
    <motion.nav
      aria-label={t("nav.primaryNavigation")}
      animate={{
        scale: compact ? 0.84 : 1,
        y: compact ? 8 : 0
      }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="floating-nav ios-glass-nav fixed inset-x-0 z-50 mx-auto flex w-[calc(100%_-_1.5rem)] max-w-[430px] origin-bottom items-center justify-between rounded-[36px] px-3 py-3 will-change-transform"
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
                  ? "h-12 w-12 rounded-full border border-white/[0.08] bg-white/[0.88] text-black shadow-[0_18px_40px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.36)] backdrop-blur-[16px]"
                  : isActive
                    ? "h-11 w-11 rounded-[18px] bg-white/[0.07] text-white"
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
