export type ScheduleDay =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type ScheduleRule = {
  id?: string;
  itemType: "ACTIVITY" | "ABSENCE";
  workTypeId: string | null;
  workTypeName?: string;
  workTypeColor?: string;
  absenceTypeId: string | null;
  absenceTypeName?: string;
  absenceTypeColor?: string;
  dayOfWeek: ScheduleDay;
  startTime: string;
  endTime: string;
  breakMinutes: number;
};

export type WeeklySchedule = {
  id: string;
  employmentId: string;
  name: string;
  timezone: string;
  validFrom: string;
  validTo: string | null;
  version: number;
  rules: ScheduleRule[];
};

export type WeeklySchedulePayload = {
  name: string;
  timezone: string;
  validFrom: string;
  validTo: string | null;
  rules: ScheduleRule[];
};

export type ScheduledShift = {
  shiftId: string;
  assignmentId: string;
  employmentId: string;
  itemType: "ACTIVITY" | "ABSENCE";
  workTypeId: string | null;
  workTypeName: string;
  workTypeColor: string;
  absenceTypeId: string | null;
  absenceTypeName: string | null;
  absenceTypeColor: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  breakMinutes: number;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";
  assignmentStatus: "ASSIGNED" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  source: "RECURRING_TEMPLATE" | "MANUAL" | "IMPORTED";
};

export type ShiftOverridePayload = {
  date: string;
  startTime: string;
  endTime: string;
};
