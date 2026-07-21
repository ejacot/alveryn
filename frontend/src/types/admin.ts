export type FounderOverview = {
  totalUsers: number;
  verifiedUsers: number;
  registrationsToday: number;
  registrationsLast7Days: number;
  activeToday: number;
  activeLast7Days: number;
  activeLast30Days: number;
};

export type FounderUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  status: "ACTIVE" | "LOCKED" | "DELETED";
  registeredAt: string;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  onboardingCompleted: boolean;
  employmentCount: number;
  workTypeCount: number;
  workSessionCount: number;
};

export type FounderDashboard = {
  overview: FounderOverview;
  activation: {
    registered: number;
    verified: number;
    trackingSetupCompleted: number;
    employmentCreated: number;
    workTypeCreated: number;
    firstWorkSessionCreated: number;
  };
  usage: {
    timeTrackingUsers: number;
    earningsTrackingUsers: number;
    employments: number;
    workTypes: number;
    workSessions: number;
    projects: number;
    checkIns: number;
    pdfExports: number;
  };
  registrations: Array<{ date: string; registrations: number }>;
  users: FounderUser[];
};
