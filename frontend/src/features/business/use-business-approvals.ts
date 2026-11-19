import { useQuery } from "@tanstack/react-query";
import { getOrganizationAccess, listPendingBusinessAbsenceRequests, listPendingStaffingResults } from "../../api/endpoints";

export function useBusinessApprovals(organizationId: string) {
  const access = useQuery({
    queryKey: ["organizations", organizationId, "access"],
    queryFn: () => getOrganizationAccess(organizationId),
    enabled: Boolean(organizationId),
  });
  const permissions = access.data?.permissions ?? [];
  const canApproveHours = permissions.includes("APPROVE_ACTUALS");
  const canApproveAbsences = permissions.includes("MANAGE_ABSENCES") &&
    access.data?.organizationWideAbsenceApproval !== false;
  const hours = useQuery({
    queryKey: ["business-approvals", organizationId, "hours"],
    queryFn: () => listPendingStaffingResults(organizationId),
    enabled: canApproveHours,
  });
  const absences = useQuery({
    queryKey: ["business-approvals", organizationId, "absences"],
    queryFn: () => listPendingBusinessAbsenceRequests(organizationId),
    enabled: canApproveAbsences,
  });
  return { access, canApproveHours, canApproveAbsences, hours, absences };
}
