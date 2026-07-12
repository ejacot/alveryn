export type OnboardingStatus = {
  profileConfigured: boolean;
  preferencesConfigured: boolean;
  hourlyRateConfigured: boolean;
  workTypeConfigured: boolean;
  onboardingCompleted: boolean;
  missingSteps: string[];
};
