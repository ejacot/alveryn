import {
  BriefcaseBusiness,
  CalendarDays,
  CalendarClock,
  ChartColumnIncreasing,
  House,
  Settings,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { APP_HOME_PATH } from "../../routes/app-paths";
import { cn } from "../../utils/cn";
import { AppLogo } from "../branding/app-logo";
import { getOrganizationAccess, listOrganizations } from "../../api/endpoints";

type NavItem = {
  to: string;
  icon: typeof House;
  label: string;
};

export function BottomNav() {
  const { t } = useTranslation("common");
  const organizations = useQuery({
    queryKey: ["organizations"],
    queryFn: listOrganizations,
  });
  const businessOrganizations = (organizations.data ?? []).filter(
    (organization) => organization.type === "BUSINESS",
  );
  const businessAccess = useQuery({
    queryKey: [
      "organizations",
      "navigation-access",
      businessOrganizations.map((item) => item.id),
    ],
    queryFn: () =>
      Promise.all(
        businessOrganizations.map((organization) =>
          getOrganizationAccess(organization.id),
        ),
      ),
    enabled: businessOrganizations.length > 0,
  });
  const belongsToBusinessWorkspace = businessOrganizations.length > 0;
  const canOpenBusiness = (businessAccess.data ?? []).some(
    (access) => access.permissions.length > 0,
  );
  const items: NavItem[] = [
    { to: APP_HOME_PATH, icon: House, label: t("nav.home") },
    { to: "/calendar", icon: CalendarDays, label: t("nav.calendar") },
    ...(belongsToBusinessWorkspace
      ? [{ to: "/schedule", icon: CalendarClock, label: t("nav.schedule") }]
      : []),
    ...(canOpenBusiness
      ? [{ to: "/business", icon: BriefcaseBusiness, label: t("nav.business") }]
      : []),
    {
      to: "/statistics",
      icon: ChartColumnIncreasing,
      label: t("nav.statistics"),
    },
    { to: "/profile", icon: Settings, label: t("nav.settings") },
  ];

  return (
    <nav
      aria-label={t("nav.primaryNavigation")}
      className="floating-nav ios-glass-nav fixed inset-x-0 z-50 mx-auto flex w-[calc(100%_-_1.5rem)] max-w-[430px] items-center justify-between rounded-[30px] p-2"
    >
      <div className="desktop-nav-brand hidden" aria-hidden="true">
        <AppLogo wordmark className="justify-start" />
      </div>
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          aria-label={label}
          className="desktop-nav-link relative flex min-w-0 flex-1 justify-center rounded-[22px]"
        >
          {({ isActive }) => (
            <div
              className={cn(
                "desktop-nav-item flex h-[54px] w-full flex-col items-center justify-center gap-1 rounded-[22px] transition-[background,color,transform] duration-200",
                isActive
                  ? "bg-[rgba(16,185,129,0.12)] text-[#34d399]"
                  : "text-white/42 active:scale-[0.96]",
              )}
              title={label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={isActive ? "h-[21px] w-[21px]" : "h-5 w-5"}
                strokeWidth={isActive ? 2.35 : 1.9}
                aria-hidden="true"
              />
              <span className="desktop-nav-label max-w-full truncate text-[0.62rem] font-medium leading-none tracking-[-0.01em]">
                {label}
              </span>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
