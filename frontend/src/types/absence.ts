export type AbsenceType =
  | "DAY_OFF"
  | "VACATION"
  | "SICK_LEAVE"
  | "PUBLIC_HOLIDAY";

export type Absence = {
  id: string;
  employmentId?: string | null;
  employmentName?: string | null;
  absenceTypeId?: string | null;
  absenceType: AbsenceType;
  absenceTypeName: string;
  paid: boolean;
  paidMinutesPerDay: number;
  startDate: string;
  endDate: string;
  notes: string | null;
};

export type AbsenceTypeSetting = {
  id: string;
  name: string;
  code: AbsenceType | null;
  paid: boolean;
  paidMinutesPerDay: number;
  color: string;
  active: boolean;
  displayOrder: number;
  deletable?: boolean;
};
