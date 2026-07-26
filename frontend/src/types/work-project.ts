export type WorkProjectStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

export type WorkProject = {
  id: string;
  employmentId: string;
  employmentName: string;
  title: string;
  description?: string | null;
  clientName?: string | null;
  reference?: string | null;
  startDate: string;
  endDate?: string | null;
  status: WorkProjectStatus;
  notes?: string | null;
  addressId?: string | null;
  sessionCount: number;
};

export type WorkProjectPayload = {
  employmentId: string;
  title: string;
  description?: string | null;
  clientName?: string | null;
  reference?: string | null;
  startDate: string;
  endDate?: string | null;
  status?: WorkProjectStatus | null;
  notes?: string | null;
  addressId?: string | null;
};
