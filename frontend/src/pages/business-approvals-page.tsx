import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { approveStaffingResult, decideBusinessAbsenceRequest } from "../api/endpoints";
import { BusinessManagementShell } from "../components/business-planning/business-management-shell";
import { useBusinessApprovals } from "../features/business/use-business-approvals";
import type { StaffingAssignmentResult } from "../types/business";

export function BusinessApprovalsPage() {
  const { organizationId = "" } = useParams();
  const { t } = useTranslation(["business", "common"]);
  const client = useQueryClient();
  const { access, canApproveHours, canApproveAbsences, hours, absences } = useBusinessApprovals(organizationId);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["business-approvals", organizationId] }),
      client.invalidateQueries({ queryKey: ["organizations", organizationId, "members"] }),
      client.invalidateQueries({ queryKey: ["staffing-plan", organizationId] }),
    ]);
  };
  const approve = useMutation({
    mutationFn: ({ result, form }: { result: StaffingAssignmentResult; form: FormData }) => {
      const quantity = String(form.get("quantity") ?? "");
      return approveStaffingResult(organizationId, result.id, {
        actualStartTime: String(form.get("start") || "") || null,
        actualEndTime: String(form.get("end") || "") || null,
        breakMinutes: Number(form.get("break") || 0),
        completedQuantity: quantity ? Number(quantity) : null,
        notes: String(form.get("notes") || "") || null,
      });
    },
    onSuccess: refresh,
  });
  const decide = useMutation({
    mutationFn: ({ id, accepted }: { id: string; accepted: boolean }) =>
      decideBusinessAbsenceRequest(organizationId, id, accepted),
    onSuccess: refresh,
  });
  const error = <p role="alert">{t("common:messages.genericError")}</p>;
  const loading = <p role="status">{t("common:messages.loading")}</p>;

  return (
    <BusinessManagementShell>
      <div className="business-overview">
        <header><h1>{t("plannerTools.reviews")}</h1></header>
        {access.isPending && loading}
        {access.isError && error}
        {access.isSuccess && !canApproveHours && !canApproveAbsences && <p>{t("navigation.noAccess")}</p>}
        {canApproveHours && (
          <section className="business-summary-panel">
            <h2>{t("plannerTools.resultsToReview")}</h2>
            {hours.isPending ? loading : hours.isError ? error : hours.data?.length === 0 && <p>{t("plannerTools.noPendingResults")}</p>}
            {(hours.data ?? []).map((result) => (
              <details className="business-approval-item" key={result.id}>
                <summary><strong>{result.memberName}</strong> · {result.workTypeName} · {result.date}</summary>
                <form className="business-approval-form" onSubmit={(event) => {
                  event.preventDefault();
                  approve.mutate({ result, form: new FormData(event.currentTarget) });
                }}>
                  <label>{t("plannerTools.actualStart")}<input name="start" type="time" step="1" defaultValue={result.actualStartTime ?? ""} /></label>
                  <label>{t("plannerTools.actualEnd")}<input name="end" type="time" step="1" defaultValue={result.actualEndTime ?? ""} /></label>
                  <label>{t("plannerTools.breakMinutes")}<input name="break" type="number" min="0" defaultValue={result.breakMinutes} /></label>
                  <label>{t("plannerTools.quantity")}<input name="quantity" type="number" min="0" step="any" defaultValue={result.completedQuantity ?? ""} /></label>
                  <label>{t("plannerTools.notes")}<textarea name="notes" defaultValue={result.notes ?? ""} /></label>
                  {approve.isError && approve.variables?.result.id === result.id && error}
                  <button className="business-admin__primary" type="submit" disabled={approve.isPending}>{t("plannerTools.approveAndSave")}</button>
                </form>
              </details>
            ))}
          </section>
        )}
        {canApproveAbsences && (
          <section className="business-summary-panel">
            <h2>{t("plannerTools.absenceRequests")}</h2>
            {absences.isPending ? loading : absences.isError ? error : absences.data?.length === 0 && <p>{t("plannerTools.noPendingAbsences")}</p>}
            {(absences.data ?? []).map((request) => (
              <article className="business-approval-item" key={request.id}>
                <strong>{request.memberName}</strong>
                <p>{t(`dayTypes.${request.type}`)} · {request.startDate} – {request.endDate}</p>
                {request.notes && <p>{request.notes}</p>}
                {decide.isError && decide.variables?.id === request.id && error}
                <div className="business-approval-actions">
                  <button className="business-admin__primary" type="button" disabled={decide.isPending} onClick={() => decide.mutate({ id: request.id, accepted: true })}>{t("plannerTools.approve")}</button>
                  <button className="business-admin__secondary" type="button" disabled={decide.isPending} onClick={() => decide.mutate({ id: request.id, accepted: false })}>{t("plannerTools.reject")}</button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </BusinessManagementShell>
  );
}
