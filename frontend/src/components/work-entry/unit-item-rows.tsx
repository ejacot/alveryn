import type { FieldArrayWithId, UseFormRegister } from "react-hook-form";
import type { UnitType } from "../../types/configuration";
import type { WorkEntryFormInput } from "../../features/work-entries/work-entry-schemas";
import { Input } from "../ui/input";

type Props = {
  fields: FieldArrayWithId<WorkEntryFormInput, "unitItems", "id">[];
  unitTypes: UnitType[];
  register: UseFormRegister<WorkEntryFormInput>;
  errors: Array<{ unitTypeId?: { message?: string }; quantity?: { message?: string } } | undefined>;
};

export function UnitItemRows({
  fields,
  unitTypes,
  register,
  errors
}: Props) {
  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="surface-muted p-4"
        >
          <div className="grid gap-3 sm:grid-cols-[1fr,140px] sm:items-end">
            <div>
              <input type="hidden" {...register(`unitItems.${index}.unitTypeId`)} />
              <p className="text-base font-semibold tracking-[-0.03em] text-white">
                {unitTypes[index]?.name ?? "Unit"}
              </p>
              <p className="mt-1 text-sm text-white/46">
                {unitTypes[index]?.unitsPerHour} per hour
              </p>
              {errors[index]?.unitTypeId?.message ? (
                <p className="mt-2 text-sm text-red-300">{errors[index]?.unitTypeId?.message}</p>
              ) : null}
            </div>
            <Input
              label="Units"
              type="number"
              min={0}
              step="0.1"
              error={errors[index]?.quantity?.message}
              {...register(`unitItems.${index}.quantity`, {
                setValueAs: (value) => (value === "" ? 0 : Number(value))
              })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
