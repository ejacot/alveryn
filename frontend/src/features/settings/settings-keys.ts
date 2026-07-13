export const settingsKeys = {
  profile: () => ["settings", "profile"] as const,
  preferences: () => ["settings", "preferences"] as const,
  hourlyRates: () => ["settings", "hourly-rates"] as const,
  hourlyRate: (id: string) => ["settings", "hourly-rates", id] as const,
  workTypes: () => ["settings", "work-types"] as const,
  workType: (id: string) => ["settings", "work-types", id] as const,
  unitTypes: (workTypeId: string) => ["settings", "work-types", workTypeId, "unit-types"] as const,
  unitType: (workTypeId: string, unitTypeId: string) =>
    ["settings", "work-types", workTypeId, "unit-types", unitTypeId] as const
};
