import { z } from "zod";

export const profileStepSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80)
});

export type ProfileStepValues = z.infer<typeof profileStepSchema>;

export const preferencesStepSchema = z.object({
  language: z.string().trim().min(2).max(10),
  currency: z.string().trim().length(3, "Use a 3-letter currency"),
  timezone: z.string().trim().min(1, "Timezone is required").max(60),
  defaultBreakMinutes: z.coerce.number().int().min(0),
  preferredDailyHours: z.coerce.number().positive("Use a positive number").max(24)
});

export type PreferencesStepValues = z.infer<typeof preferencesStepSchema>;

export const hourlyRateStepSchema = z.object({
  hourlyRate: z.preprocess(
    (value) => {
      if (typeof value === "string") {
        const normalized = value.trim().replace(",", ".");
        return normalized === "" ? undefined : Number(normalized);
      }
      return value;
    },
    z.number().min(0, "Rate must be zero or positive")
  ),
  currency: z.string().trim().length(3, "Use a 3-letter currency").transform((value) => value.toUpperCase())
});

export type HourlyRateStepValues = z.infer<typeof hourlyRateStepSchema>;

export const workTypeStepSchema = z.object({
  name: z.string().trim().min(1, "Work type name is required").max(100),
  calculationMethod: z.enum(["TIME_BASED", "UNIT_BASED"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a #RRGGBB color"),
  icon: z.string().trim().max(100).optional().or(z.literal("")),
  defaultBreakMinutes: z.coerce.number().int().min(0).optional(),
  displayOrder: z.coerce.number().int().min(0)
});

export type WorkTypeStepValues = z.infer<typeof workTypeStepSchema>;

export const unitTypeStepSchema = z.object({
  name: z.string().trim().min(1, "Unit type name is required").max(100),
  unitsPerHour: z.coerce.number().positive("Units per hour must be greater than zero"),
  displayOrder: z.coerce.number().int().min(0)
});

export type UnitTypeStepValues = z.infer<typeof unitTypeStepSchema>;
