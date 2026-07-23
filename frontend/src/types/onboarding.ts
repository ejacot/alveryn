export type OnboardingStatus = {
  profileConfigured: boolean;
  preferencesConfigured: boolean;
  employmentConfigured: boolean;
  hourlyRateConfigured: boolean;
  workTypeConfigured: boolean;
  onboardingCompleted: boolean;
  missingSteps: string[];
};
