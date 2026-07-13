export type AbsenceType =
  | "DAY_OFF"
  | "VACATION"
  | "SICK_LEAVE"
  | "PUBLIC_HOLIDAY";

export type Absence = {
  id: string;
  absenceType: AbsenceType;
  startDate: string;
  endDate: string;
  notes: string | null;
};
