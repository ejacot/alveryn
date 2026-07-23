import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, Building2, CalendarDays, Clock3, House, Plus, Settings
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { listOrganizations } from "../../api/endpoints";
import { queryKeys } from "../../api/query-keys";
import { useWorkspaceScope } from "../../features/organization/workspace-scope";
import { cn } from "../../utils/cn";
import { AppLogo } from "../branding/app-logo";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function DesktopSidebar({ addEntryDate }: { addEntryDate: string }) {
  const { t } = useTranslation("common");
  const selectedId = useWorkspaceScope();
  const organizations = useQuery({
    queryKey: queryKeys.organizations.all(),
    queryFn: listOrganizations
  });
  const selected = organizations.data?.find((item) => item.id === selectedId);
  const business = selected?.type === "BUSINESS";
  const items = [
    { to: business ? "/business" : "/app", label: t("nav.home"), icon: House },
    { to: "/calendar", label: t("nav.calendar"), icon: CalendarDays },
    { to: "/statistics", label: t("nav.statistics"), icon: BarChart3 },
    ...(business ? [{ to: "/business", label: "Business", icon: Building2 }] : []),
    { to: "/profile", label: t("nav.settings"), icon: Settings }
  ];

  return (
    <aside className="desktop-sidebar hidden lg:flex" aria-label="Desktop navigation">
      <div className="flex h-20 items-center px-6">
        <AppLogo className="justify-start" />
      </div>
      <div className="px-4">
        <WorkspaceSwitcher />
      </div>
      <nav className="mt-7 flex flex-1 flex-col gap-1 px-3" aria-label={`Desktop ${t("nav.primaryNavigation")}`}>
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={`${to}-${label}`} to={to} end={to === "/app"}
            className={({ isActive }) => cn(
              "group flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition",
              isActive ? "bg-white/[0.09] text-white" : "text-white/48 hover:bg-white/[0.045] hover:text-white/80"
            )}>
            <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4">
        <NavLink to={`/records/new?date=${addEntryDate}`}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("nav.addEntry")}
        </NavLink>
        <div className="mt-4 flex items-center gap-2 px-2 text-[11px] text-white/28">
          <Clock3 className="h-3.5 w-3.5" />
          <span>Workforce, clearly organized</span>
        </div>
      </div>
    </aside>
  );
}
