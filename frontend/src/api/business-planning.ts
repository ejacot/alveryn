import type { ApiResponse } from "../types/api";
import type { AxiosResponse } from "axios";
import type {
  ApiEntityResult,
  StaffingDemand,
  StaffingDemandBatchAction,
  StaffingMutationResult,
  StaffingPlanBootstrapResult,
  StaffingPlanLookup,
  StaffingRequirementInput,
  StaffingRequirementUpdateInput,
} from "../types/business-planning";
import { http } from "./http";

function response<T>(
  value: Pick<AxiosResponse<ApiResponse<T>>, "data" | "headers" | "status">,
): ApiEntityResult<T> {
  const rawEtag = typeof value.headers.get === "function"
    ? value.headers.get("etag")
    : value.headers.etag;
  const replay = typeof value.headers.get === "function"
    ? value.headers.get("idempotent-replay")
    : value.headers["idempotent-replay"];
  return {
    data: value.data.data,
    etag: typeof rawEtag === "string" ? rawEtag : null,
    status: value.status,
    idempotentReplay: replay === "true",
  };
}

function planPath(organizationId: string) {
  return `/api/organizations/${organizationId}/staffing/plans`;
}

export async function findStaffingPlan(
  organizationId: string,
  unitId: string,
  weekStart: string,
) {
  return response(
    await http.get<ApiResponse<StaffingPlanLookup>>(planPath(organizationId), {
      params: { unitId, weekStart },
    }),
  );
}

export async function createStaffingPlan(
  organizationId: string,
  input: { unitId: string; weekStart: string },
  idempotencyKey: string,
) {
  return response(
    await http.post<ApiResponse<StaffingPlanBootstrapResult>>(
      planPath(organizationId),
      input,
      { headers: { "Idempotency-Key": idempotencyKey } },
    ),
  );
}

export async function getStaffingDemand(
  organizationId: string,
  planId: string,
) {
  return response(
    await http.get<ApiResponse<StaffingDemand>>(
      `${planPath(organizationId)}/${planId}/demand`,
    ),
  );
}

export async function createStaffingRequirement(
  organizationId: string,
  planId: string,
  etag: string,
  idempotencyKey: string,
  input: StaffingRequirementInput,
) {
  return response(
    await http.post<ApiResponse<StaffingMutationResult>>(
      `${planPath(organizationId)}/${planId}/demand/requirements`,
      input,
      {
        headers: {
          "If-Match": etag,
          "Idempotency-Key": idempotencyKey,
        },
      },
    ),
  );
}

export async function updateStaffingRequirement(
  organizationId: string,
  planId: string,
  requirementId: string,
  etag: string,
  input: StaffingRequirementUpdateInput,
) {
  return response(
    await http.put<ApiResponse<StaffingMutationResult>>(
      `${planPath(organizationId)}/${planId}/demand/requirements/${requirementId}`,
      input,
      { headers: { "If-Match": etag } },
    ),
  );
}

export async function deleteStaffingRequirement(
  organizationId: string,
  planId: string,
  requirementId: string,
  etag: string,
) {
  return response(
    await http.delete<ApiResponse<StaffingMutationResult>>(
      `${planPath(organizationId)}/${planId}/demand/requirements/${requirementId}`,
      { headers: { "If-Match": etag } },
    ),
  );
}

export async function batchStaffingDemand(
  organizationId: string,
  planId: string,
  etag: string,
  idempotencyKey: string,
  actions: StaffingDemandBatchAction[],
) {
  return response(
    await http.post<ApiResponse<StaffingMutationResult>>(
      `${planPath(organizationId)}/${planId}/demand/batch`,
      { actions },
      {
        headers: {
          "If-Match": etag,
          "Idempotency-Key": idempotencyKey,
        },
      },
    ),
  );
}
