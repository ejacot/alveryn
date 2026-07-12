import { z } from "zod";

export const unitItemSchema = z.object({
  unitTypeId: z.string().min(1, "Select a unit type"),
  quantity: z.number().positive("Use a positive quantity")
});

export const workEntrySchema = z
  .object({
    workDate: z.string().min(1, "Date is required"),
    workTypeId: z.string().min(1, "Choose a work type"),
    startTime: z.string().optional().or(z.literal("")),
    endTime: z.string().optional().or(z.literal("")),
    unpaidBreakMinutes: z.number().int().min(0).default(0),
    notes: z.string().max(500).optional().or(z.literal("")),
    unitItems: z.array(unitItemSchema).default([])
  })
  .superRefine((values, context) => {
    const hasTimeFields = Boolean(values.startTime && values.endTime);
    const hasUnitRows = values.unitItems.some(
      (item) => item.unitTypeId && Number(item.quantity) > 0
    );

    if (!hasTimeFields && !hasUnitRows) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Complete either the time details or the unit rows"
      });
    }
  });

export type WorkEntryFormInput = z.input<typeof workEntrySchema>;
export type WorkEntryFormValues = z.output<typeof workEntrySchema>;
