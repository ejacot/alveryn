export type EmploymentRestDay = {
  id: string;
  employmentId: string;
  date: string;
  source: "MANUAL";
  notes: string | null;
};
