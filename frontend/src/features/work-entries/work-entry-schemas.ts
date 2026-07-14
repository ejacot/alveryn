import { z } from "zod";

type Translate = (key: string) => string;

const fallbackT: Translate = (key) => key;

export function createWorkEntrySchema(t: Translate = fallbackT) {
  const unitItemSchema = z.object({
    unitTypeId: z.string().optional().or(z.literal("")),
    quantity: z.preprocess(
      (value) => {
        if (value === "" || value == null) {
          return 0;
        }
        if (typeof value === "number" && Number.isNaN(value)) {
          return 0;
        }
        return Number(value);
      },
      z.number().min(0, t("validation.positiveOrZeroQuantity"))
    )
  });

  return z
    .object({
      workDate: z.string().min(1, t("validation.dateRequired")),
      workTypeId: z.string().min(1, t("validation.chooseWorkType")),
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
          message: t("validation.completeTimeOrUnits")
        });
      }
    });
}

export const workEntrySchema = createWorkEntrySchema();

export type WorkEntryFormInput = z.input<typeof workEntrySchema>;
export type WorkEntryFormValues = z.output<typeof workEntrySchema>;
