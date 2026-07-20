export type WorkSession = {
  id: string;
  employmentId: string;
  employmentName: string;
  workTypeId: string;
  workTypeName: string;
  defaultBreakMinutes: number;
  checkedInAt: string;
  checkedOutAt: string | null;
  timezone: string;
  breakMinutes: number;
  notes: string | null;
  workRecordId: string | null;
  pauseStartedAt: string | null;
  accumulatedBreakSeconds: number;
  overdue: boolean;
};

export type WorkSessionCheckoutPayload = {
  breakMinutes?: number | null;
  notes?: string | null;
  correctedCheckInAt?: string | null;
  correctedCheckOutAt?: string | null;
};
