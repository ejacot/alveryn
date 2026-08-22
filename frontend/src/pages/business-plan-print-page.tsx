import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { getStaffingVersion } from "../api/business-planning";
import {
  ImmutablePlanPrintDocument,
  StaffingSummaryPrintDocument,
  openImmutablePlanPrint,
} from "../components/business-planning/immutable-plan-print";
import "../styles/immutable-plan-print.css";

type DocumentKind = "employee" | "summary";

export function BusinessPlanPrintPage() {
  const { t, i18n } = useTranslation("business");
  const { organizationId = "", planId = "", versionNumber = "" } = useParams();
  const [searchParams] = useSearchParams();
  const [documentKind, setDocumentKind] = useState<DocumentKind>("employee");
  const version = Number(versionNumber);
  const unitId = searchParams.get("unit") ?? "";
  const weekStart = searchParams.get("week") ?? "";
  const query = useQuery({
    queryKey: ["staffing-plan", organizationId, planId, "version", version],
    queryFn: () => getStaffingVersion(organizationId, planId, version),
    enabled: Boolean(organizationId && planId && Number.isInteger(version) && version > 0),
    retry: false,
  });
  const detail = query.data?.data ?? null;
  const contextMatches = detail != null
    && detail.organizationId === organizationId
    && detail.planId === planId
    && detail.versionNumber === version
    && detail.unitId === unitId
    && detail.weekStart === weekStart;
  const reviewHref = `/business/${organizationId}/plan/review?unit=${encodeURIComponent(unitId)}&week=${encodeURIComponent(weekStart)}`;

  if (query.isLoading) return <main className="immutable-plan-route__state" role="status">{t("planning.review.loading")}</main>;
  if (query.isError || !contextMatches) {
    const error = query.isError ? getApiError(query.error) : null;
    return <main className="immutable-plan-route__state" role="alert"><h1>{error?.status === 403 ? "403" : "404"}</h1><p>{t("planning.states.notFoundDescription")}</p></main>;
  }

  const locale = i18n.resolvedLanguage ?? i18n.language;
  return (
    <main className="immutable-plan-route business-planning">
      <header className="immutable-plan-print__toolbar">
        <div>
          <span>{t("planning.print.eyebrow", { version })}</span>
          <h1>{t("planning.print.previewTitle")}</h1>
          <p>{t("planning.print.previewHint")}</p>
        </div>
        <div className="immutable-plan-print__actions">
          <Link to={reviewHref}><ArrowLeft aria-hidden="true" />{t("planning.print.close")}</Link>
          <button type="button" aria-pressed={documentKind === "employee"} onClick={() => setDocumentKind("employee")}>Employee plan</button>
          <button type="button" aria-pressed={documentKind === "summary"} onClick={() => setDocumentKind("summary")}>Staffing summary</button>
          <button type="button" className="is-primary" onClick={openImmutablePlanPrint}><Printer aria-hidden="true" />{t("planning.print.print")}</button>
        </div>
      </header>
      <div className="immutable-plan-print__viewport">
        {documentKind === "employee"
          ? <ImmutablePlanPrintDocument detail={detail} locale={locale} />
          : <StaffingSummaryPrintDocument detail={detail} locale={locale} />}
      </div>
    </main>
  );
}
