import {
  Building2,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Menu,
  Settings2,
  LogOut,
  X,
} from "lucide-react";
import { useContext, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { i18n } from "../../i18n";
import { useBusinessApprovals } from "../../features/business/use-business-approvals";
import { useQuery } from "@tanstack/react-query";
import { planContextSearch, planSelectedDay } from "../../features/business/plan-context";
import { getStaffingReview } from "../../api/business-planning";
import type { StaffingPlanHeader } from "../../types/business-planning";
import { normalizeLanguage } from "../../i18n/language";
import type { Organization, OrganizationUnit } from "../../types/business";
import { AppLogo } from "../branding/app-logo";
import { APP_HOME_PATH } from "../../routes/app-paths";
import { useOptionalWorkspace } from "../../contexts/workspace-context";
import { AuthContext } from "../../features/auth/auth-context";

type Props = {
  organizations: Organization[];
  organizationId: string;
  units: OrganizationUnit[];
  unitId: string;
  weekStart: string;
  weekEnd: string;
  children: ReactNode;
  onOrganizationChange: (organizationId: string) => void;
  onUnitChange: (unitId: string) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
  showWeekControls?: boolean;
  showUnitControls?: boolean;
  sectionLabel?: string;
  plan?: StaffingPlanHeader | null;
};

export function BusinessPlanningShell({
  organizations,
  organizationId,
  units,
  unitId,
  weekStart,
  weekEnd,
  children,
  onOrganizationChange,
  onUnitChange,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
  showWeekControls = true,
  showUnitControls = showWeekControls,
  sectionLabel,
  plan,
}: Props) {
  const { t } = useTranslation("business");
  const navigate = useNavigate();
  const location = useLocation();
  const workspace = useOptionalWorkspace();
  const auth = useContext(AuthContext);
  const managedOrganizations = auth?.user?.managedBusinessOrganizationIds ?? [];
  const businessOnly = managedOrganizations.length > 0;
  const organizationOptions = businessOnly
    ? organizations.filter((organization) => managedOrganizations.includes(organization.id))
    : organizations;
  const availableWorkspaces = workspace?.organizations ?? organizations;
  const locale = normalizeLanguage(i18n.resolvedLanguage);
  const weekLabel = formatWeek(weekStart, weekEnd, locale);
  const search = new URLSearchParams(location.search);
  const timezone = organizations.find(({ id }) => id === organizationId)?.timezone ?? "UTC";
  const day = planSelectedDay(search, weekStart, weekEnd, timezone);
  const planningSearch = planContextSearch(unitId, weekStart, day, search.get("requirement") ?? undefined, search.get("assignment") ?? undefined);
  const review = useQuery({
    queryKey: ["staffing-plan", organizationId, plan?.planId, "review"],
    queryFn: () => getStaffingReview(organizationId, plan!.planId),
    enabled: Boolean(plan?.capabilities.view),
    retry: false,
  }).data?.data;
  const planSteps = [
    { path: "demand", title: t("planning.navigation.demand"), detail: review && t("planFlow.required", { count: review.coverage.required }) },
    { path: "schedule", title: t("navigation.assign"), detail: review && t("planFlow.coverage", review.coverage) },
    { path: "review", title: t("navigation.publish"), detail: review && (
      plan?.latestPublishedVersion && !plan.hasUnpublishedChanges ? t("published") :
        review.blockingIssueCount ? t("planFlow.blockers", { count: review.blockingIssueCount }) :
        review.warningCount ? t("planFlow.warnings", { count: review.warningCount }) :
          review.publishable ? t("planFlow.ready") : undefined
    ) },
  ];
  const { access, canApproveHours, canApproveAbsences, hours, absences } = useBusinessApprovals(organizationId);
  const permissions = access.data?.permissions ?? [];
  const canPlan = permissions.includes("VIEW_SCHEDULE");
  const pendingApprovals = (hours.data?.length ?? 0) + (absences.data?.length ?? 0);
  const approvalsLabel = pendingApprovals ? `${t("plannerTools.reviews")} · ${pendingApprovals}` : t("plannerTools.reviews");
  const canConfigure = permissions.some((permission) => [
    "MANAGE_MEMBERS", "MANAGE_ROLES", "MANAGE_TEAMS", "MANAGE_SCHEDULE"
  ].includes(permission));
  const base = `/business/${organizationId}`;
  const planning = location.pathname.startsWith(`${base}/plan/`);
  const configuring = ["/settings", "/people", "/roles", "/locations", "/work-types"]
    .some((path) => location.pathname === base + path || location.pathname.startsWith(base + path + "/"));
  const navigation = [
    { to: `${base}/overview`, text: t("navigation.overview"), Icon: Building2, active: location.pathname === `${base}/overview` },
    ...(canPlan ? [
      { to: `${base}/plan${planningSearch}`, text: t("navigation.plan"), Icon: CalendarRange, active: location.pathname === `${base}/plan` },
      { to: `${base}/plan/schedule${planningSearch}`, text: t("publishedPlan.planning"), Icon: ClipboardList, active: planning },
    ] : []),
    ...(canApproveHours || canApproveAbsences ? [{ to: `${base}/approvals`, text: approvalsLabel, Icon: ClipboardList, active: location.pathname === `${base}/approvals` }] : []),
    ...(canConfigure ? [{ to: `${base}/settings`, text: t("navigation.settings"), Icon: Settings2, active: configuring }] : []),
  ];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [mobileMenuOpen]);

  return (
    <div className="business-planning">
      <div className="business-planning__grid" aria-hidden="true" />
      <header className={`business-planning__topbar${showUnitControls ? "" : " business-planning__topbar--management"}`}>
        <Link to={`/business/${organizationId}/overview`} className="business-planning__brand" aria-label="Alveryn Business">
          <AppLogo wordmark />
          <span className="business-planning__mobile-page-title">Business</span>
        </Link>

        <label className="business-planning__workspace-control">
          <span>{t("organizationSetup.company")}</span>
          <select
            aria-label={t("organizationSetup.company")}
            value={`business:${organizationId}`}
            onChange={(event) => {
              if (event.target.value === "personal") {
                const personalWorkspace = availableWorkspaces.find((workspace) => workspace.type === "PERSONAL");
                if (personalWorkspace) workspace?.setActiveWorkspaceId(personalWorkspace.id);
                navigate(APP_HOME_PATH);
                return;
              }
              const nextOrganizationId = event.target.value.replace("business:", "");
              workspace?.setActiveWorkspaceId(nextOrganizationId);
              onOrganizationChange(nextOrganizationId);
            }}
          >
            {!businessOnly && <option value="personal">{t("planning.workspace.personal")}</option>}
            {organizationOptions.map((organization) => (
              <option key={organization.id} value={`business:${organization.id}`}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>

        {showUnitControls && <label className="business-planning__unit-control">
          <span>{t("planning.unit")}</span>
          <select
            aria-label={t("planning.unit")}
            value={unitId}
            onChange={(event) => onUnitChange(event.target.value)}
          >
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
        </label>}

        {showWeekControls ? <div className="business-planning__week-switcher" aria-label={t("planning.week.label")}>
          <button type="button" onClick={onPreviousWeek} aria-label={t("planning.week.previous")}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" onClick={onCurrentWeek} className="business-planning__week-label">
            <span>{t("planning.week.kicker")}</span>
            <strong>{weekLabel}</strong>
          </button>
          <button type="button" onClick={onNextWeek} aria-label={t("planning.week.next")}>
            <ChevronRight aria-hidden="true" />
          </button>
        </div> : <div className="business-planning__section-label">{sectionLabel}</div>}

        <div className="business-planning__tools">
          {businessOnly && auth && <button
            type="button"
            className="business-planning__tool"
            aria-label={t("logout", { ns: "settings" })}
            title={t("logout", { ns: "settings" })}
            onClick={() => void auth.logout()}
          ><LogOut aria-hidden="true" /></button>}
          <button
            type="button"
            className="business-planning__tool business-planning__mobile-menu-trigger"
            aria-label={t("management.mobileOpen")}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu aria-hidden="true" />
          </button>
        </div>
      </header>

      <aside className="business-planning__rail" aria-label={t("planning.navigation.label")}>
        <nav className="business-primary-nav">
          {navigation.map(({ to, text, Icon, active }) => (
            <Link key={to} to={to} aria-current={active ? "page" : undefined} className={`${active ? "active" : ""}${to.endsWith("/settings") ? " business-primary-nav__settings" : ""}`}>
              <Icon aria-hidden="true" /><span>{text}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {mobileMenuOpen ? <div className="business-planning__mobile-menu">
        <button type="button" className="business-planning__mobile-menu-backdrop" aria-label={t("planning.close")} onClick={() => setMobileMenuOpen(false)} />
        <aside role="dialog" aria-modal="true" aria-label={t("management.section")}>
          <header><span>{t("management.section")}</span><button type="button" aria-label={t("planning.close")} onClick={() => setMobileMenuOpen(false)}><X aria-hidden="true" /></button></header>
          <nav>
            {navigation.map(({ to, text, Icon, active }) => (
              <Link key={to} to={to} aria-current={active ? "page" : undefined} onClick={() => setMobileMenuOpen(false)}>
                <Icon aria-hidden="true" /><span>{text}</span>
              </Link>
            ))}
          </nav>
        </aside>
      </div> : null}

      <main className="business-planning__main">
        {planning && canPlan && (
          <div className="business-plan-header">
            <h1 className="business-demand__eyebrow">{t(location.pathname.endsWith("/plan/demand") ? "planning.demand.eyebrow" : location.pathname.endsWith("/plan/schedule") ? "planning.schedule.eyebrow" : "publicationLayout.eyebrow")}</h1>
            <nav className="business-plan-steps" aria-label={t("publishedPlan.planning")}>
              {planSteps.map(({ path, title, detail }) => (
                <NavLink key={path} to={`${base}/plan/${path}${planningSearch}`} aria-label={title} aria-describedby={detail ? `plan-step-${path}` : undefined}>
                  <strong>{title}</strong>{detail && <small id={`plan-step-${path}`}>{detail}</small>}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

function formatWeek(from: string, to: string, locale: string) {
  if (!from || !to) return "";
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const weekNumber = isoWeekNumber(start);
  return `KW ${weekNumber} · ${formatter.format(start)}–${formatter.format(end)}`;
}

function isoWeekNumber(date: Date) {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return Math.ceil((((value.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}
