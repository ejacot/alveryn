import { Trash2 } from "lucide-react";
import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormRegister } from "react-hook-form";
import type { UnitType } from "../../types/configuration";
import type { WorkEntryFormInput } from "../../features/work-entries/work-entry-schemas";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";

type Props = {
  fields: FieldArrayWithId<WorkEntryFormInput, "unitItems", "id">[];
  unitTypes: UnitType[];
  register: UseFormRegister<WorkEntryFormInput>;
  append: UseFieldArrayAppend<WorkEntryFormInput, "unitItems">;
  remove: UseFieldArrayRemove;
  errors: Array<{ unitTypeId?: { message?: string }; quantity?: { message?: string } } | undefined>;
};

export function UnitItemRows({
  fields,
  unitTypes,
  register,
  append,
  remove,
  errors
}: Props) {
  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="surface-muted p-4"
        >
          <div className="grid gap-3 sm:grid-cols-[1fr,120px,56px]">
            <Select
              label="Unit type"
              error={errors[index]?.unitTypeId?.message}
              {...register(`unitItems.${index}.unitTypeId`)}
            >
              <option value="">Select a unit type</option>
              {unitTypes.map((unitType) => (
                <option key={unitType.id} value={unitType.id}>
                  {unitType.name}
                </option>
              ))}
            </Select>
            <Input
              label="Units"
              type="number"
              min={0.1}
              step="0.1"
              error={errors[index]?.quantity?.message}
              {...register(`unitItems.${index}.quantity`, { valueAsNumber: true })}
            />
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                className="h-12 w-full rounded-2xl px-0"
                onClick={() => remove(index)}
                aria-label="Remove unit row"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => append({ unitTypeId: "", quantity: 1 })}
      >
        Add another unit row
      </Button>
    </div>
  );
}
