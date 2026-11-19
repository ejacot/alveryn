import { http } from "./http";
import type { BusinessEmployeeProfile, BusinessEmployeeTerm, BusinessEmployeeTermInput } from "../types/business";

export async function getBusinessEmployeeProfile(organizationId: string, memberId: string, from: string, to: string) {
  const response = await http.get<{ data: BusinessEmployeeProfile }>(
    `/api/organizations/${organizationId}/members/${memberId}/profile`, { params: { from, to } },
  );
  return response.data.data;
}

export async function addBusinessEmployeeTerms(organizationId: string, memberId: string, input: BusinessEmployeeTermInput) {
  const response = await http.post<{ data: BusinessEmployeeTerm }>(
    `/api/organizations/${organizationId}/members/${memberId}/profile/terms`, input,
  );
  return response.data.data;
}
