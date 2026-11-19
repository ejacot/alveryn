import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { findStaffingPlan, getStaffingVersion } from "../api/business-planning";
import { listOrganizations, listOrganizationUnits } from "../api/endpoints";
import { BusinessManagementShell } from "../components/business-planning/business-management-shell";
import { useBusinessApprovals } from "../features/business/use-business-approvals";
import { planContextSearch } from "../features/business/plan-context";

export function BusinessOverviewPage() {
  const { organizationId = "" } = useParams();
  const { t, i18n } = useTranslation(["business", "common"]);
  const [search] = useSearchParams();
  const base = `/business/${organizationId}`;
  const organizations = useQuery({ queryKey: ["organizations"], queryFn: listOrganizations });
  const organization = organizations.data?.find(({ id }) => id === organizationId);
  const { access, canApproveHours, canApproveAbsences, hours, absences } = useBusinessApprovals(organizationId);
  const permissions = access.data?.permissions ?? [];
  const canPlan = permissions.includes("VIEW_SCHEDULE");
  const units = useQuery({
    queryKey: ["organizations", organizationId, "units"],
    queryFn: () => listOrganizationUnits(organizationId),
    enabled: canPlan,
  });
  const activeUnits = (units.data ?? []).filter(({ active }) => active);
  const unit = activeUnits.find(({ id }) => id === search.get("unit")) ?? activeUnits[0];
  const timezone = organization?.timezone ?? "UTC";
  const dateParts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date());
  const part = (type: "year" | "month" | "day") => dateParts.find((value) => value.type === type)?.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const monday = new Date(`${today}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const week = monday.toISOString().slice(0, 10);
  const lookup = useQuery({
    queryKey: ["staffing-plan", organizationId, unit?.id, week],
    queryFn: () => findStaffingPlan(organizationId, unit!.id, week),
    enabled: canPlan && Boolean(unit && organization),
  });
  const plan = lookup.data?.data?.plan;
  const published = plan?.latestPublishedVersion;
  const version = useQuery({
    queryKey: ["staffing-plan", organizationId, plan?.planId, "version", published?.versionNumber],
    queryFn: () => getStaffingVersion(organizationId, plan!.planId, published!.versionNumber),
    enabled: Boolean(plan && published),
  });
  const snapshot = version.data?.data;
  const todayAssignments = snapshot?.assignments.filter((value) => value.date === today && value.status === "ASSIGNED") ?? [];
  const scheduled = new Set(todayAssignments.map(({ membershipId }) => membershipId).filter(Boolean)).size;
  const away = snapshot?.memberDays.filter((value) => value.date === today && ["REST_DAY", "VACATION", "SICK"].includes(value.status)) ?? [];
  const coverage = snapshot?.dayCoverage.find(({ date }) => date === today);
  const shifts = (snapshot?.requirements ?? []).filter(({ date }) => date === today)
    .sort((left, right) => (left.startTime ?? "").localeCompare(right.startTime ?? ""));
  const approvals = (hours.data?.length ?? 0) + (absences.data?.length ?? 0);
  const approvalCountKnown = (!canApproveHours || hours.isSuccess) && (!canApproveAbsences || absences.isSuccess);
  const schedulePath = `${base}/plan/schedule`;
  const planPath = `${base}/plan${planContextSearch(unit?.id ?? "", week, today)}`;
  const dateLabel = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: "full", timeZone: "UTC" })
    .format(new Date(`${today}T12:00:00Z`));

  return (
    <BusinessManagementShell showUnitControls={canPlan}>
      <div className="business-overview">
        <header>
          <h1>{t("navigation.today")}</h1>
          <span>{dateLabel}{unit && ` · ${unit.name}`}</span>
        </header>
        {access.isError && <p role="alert">{t("common:messages.genericError")}</p>}
        {(access.isPending || (canPlan && (units.isPending || (unit && lookup.isPending) || (published && version.isPending)))) &&
          <p role="status">{t("common:messages.loading")}</p>}
        {(canApproveHours || canApproveAbsences) && (
          <Link className="business-overview__planner" to={`${base}/approvals`}>
            <strong>{t("navigation.pending")}</strong><span>{approvalCountKnown ? approvals : "—"}</span>
          </Link>
        )}
        {canPlan && (
          <section className="business-summary-panel">
            <h2>{t("navigation.schedule")}</h2>
            {(units.isError || lookup.isError || version.isError) && <p role="alert">{t("common:messages.genericError")}</p>}
            {units.isSuccess && !unit && (
              <p>{t("planning.states.noUnitTitle")}{" "}
                {permissions.includes("MANAGE_TEAMS") && <Link to={`${base}/locations`}>{t("planning.states.configureUnit")}</Link>}
              </p>
            )}
            {unit && lookup.isSuccess && !published && <p>{t("navigation.unpublishedWeek")}</p>}
            {snapshot && (
              <>
                <dl className="business-summary-stats">
                  <div><dt>{t("navigation.scheduled")}</dt><dd>{scheduled}</dd></div>
                  <div><dt>{t("navigation.away")}</dt><dd>{new Set(away.map(({ membershipId }) => membershipId).filter(Boolean)).size}</dd></div>
                  <div><dt>{t("navigation.open")}</dt><dd>{coverage?.openPositions ?? (snapshot.granularCoverageAvailable ? 0 : "—")}</dd></div>
                </dl>
                {away.length > 0 && <p>{["REST_DAY", "VACATION", "SICK"].map((status) => {
                  const count = new Set(away.filter((item) => item.status === status).map(({ membershipId }) => membershipId).filter(Boolean)).size;
                  return count ? `${t(`dayTypes.${status}`)}: ${count}` : "";
                }).filter(Boolean).join(" · ")}</p>}
                {shifts.length === 0 ? <p>{t("navigation.empty")}</p> : (
                  <ul className="business-summary-shifts">
                    {shifts.map((shift, index) => {
                      const people = shift.sourceRequirementId
                        ? todayAssignments.filter((assignment) => assignment.sourceRequirementId === shift.sourceRequirementId)
                        : [];
                      const open = snapshot.requirementCoverage.find((row) => row.sourceRequirementId === shift.sourceRequirementId)?.openPositions;
                      return (
                        <li key={shift.sourceRequirementId ?? index}>
                          <time>{shift.startTime?.slice(0, 5)}{shift.endTime ? `–${shift.endTime.slice(0, 5)}` : ""}</time>
                          <strong>{shift.workTypeName}</strong>
                          <span>{people.map(({ memberDisplayName }) => memberDisplayName).join(", ") || "—"}</span>
                          {Boolean(open) && <Link to={`${schedulePath}${planContextSearch(unit?.id ?? "", week, today, shift.sourceRequirementId ?? undefined)}`}>{t("navigation.open")} · {open}</Link>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
            {plan?.hasUnpublishedChanges && <p><Link to={`${base}/plan/review?unit=${unit?.id}&week=${week}`}>{t("navigation.draft")}</Link></p>}
            {unit && <Link className="business-published-action business-published-action--primary" to={planPath}>{t("navigation.openPlan")}</Link>}
          </section>
        )}
      </div>
    </BusinessManagementShell>
  );
}
