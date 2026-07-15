import type { FieldArrayWithId, UseFormRegister } from "react-hook-form";
import { Clock3 } from "lucide-react";
import type { UnitType } from "../../types/configuration";
import type { WorkEntryFormInput } from "../../features/work-entries/work-entry-schemas";
import { parseDecimalInput } from "../../utils/decimal-input";
import { formatCurrency } from "../../utils/format";

type Props = {
  fields: FieldArrayWithId<WorkEntryFormInput, "unitItems", "id">[];
  unitTypes: UnitType[];
  register: UseFormRegister<WorkEntryFormInput>;
  unitFallbackLabel: string;
  quantityLabel: string;
  compensationMethod?: "HOURLY" | "PER_UNIT";
  values?: Array<{ quantity?: unknown }>;
  errors?: Array<{ unitTypeId?: { message?: string }; quantity?: { message?: string } } | undefined>;
};

export function UnitItemRows({
  fields,
  unitTypes,
  register,
  unitFallbackLabel,
  quantityLabel,
  compensationMethod = "HOURLY",
  values = [],
  errors = []
}: Props) {
  return (
    <div className="space-y-3">
      {fields.map((field, index) => {
        const unitType = unitTypes[index];
	        const unitName = unitType?.name ?? unitFallbackLabel;
        const symbol = unitType?.symbol ? ` ${unitType.symbol}` : "";
        const quantity = parseDecimalInput(values[index]?.quantity ?? 0);
        const rate = Number(unitType?.ratePerUnit ?? NaN);
        const subtotal =
          compensationMethod === "PER_UNIT" && Number.isFinite(quantity) && Number.isFinite(rate)
            ? quantity * rate
            : null;
	        const quantityRegistration = register(`unitItems.${index}.quantity`, {
	          setValueAs: parseDecimalInput
	        });

        return (
          <div
            key={field.id}
            className="dashboard-glass-card mx-auto w-[80%] min-w-[15.5rem] max-w-full px-5 py-4"
          >
            <div className="grid grid-cols-[minmax(0,1fr),5.25rem] items-center gap-4">
              <div className="min-w-0">
                <input type="hidden" {...register(`unitItems.${index}.unitTypeId`)} />
                <p className="truncate text-base font-semibold tracking-[-0.03em] text-white">
                  {unitName}
                </p>
                {compensationMethod === "PER_UNIT" ? (
                  <p className="mt-1.5 text-sm font-medium text-white/48">
                    {Number.isFinite(rate) && unitType?.currency
                      ? `${unitType.ratePerUnit} ${unitType.currency}/${unitType.symbol ?? unitName}`
                      : ""}
                  </p>
                ) : (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-white/42">
                    <Clock3 className="h-3.5 w-3.5 text-white/28" aria-hidden="true" />
                    <span>{unitType?.unitsPerHour ?? ""}</span>
                  </p>
                )}
                {subtotal !== null && subtotal > 0 && unitType?.currency ? (
                  <p className="mt-2 text-sm font-semibold text-white/75">
                    {`${quantity}${symbol} × ${unitType.ratePerUnit} ${unitType.currency}/${unitType.symbol ?? unitName} = ${formatCurrency(String(subtotal), unitType.currency)}`}
                  </p>
                ) : null}
                {errors[index]?.unitTypeId?.message ? (
                  <p className="mt-2 text-sm text-red-300">{errors[index]?.unitTypeId?.message}</p>
                ) : null}
              </div>
              <label className="block">
                <span className="sr-only">{`${unitName} ${quantityLabel}`}</span>
                <input
	                  type="text"
	                  inputMode="decimal"
	                  pattern="[0-9]*[,.]?[0-9]*"
                  className="h-12 w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] px-3 text-center text-base font-semibold text-white outline-none transition placeholder:text-white/40 focus:border-white/[0.28] focus:bg-white/[0.09] focus:ring-2 focus:ring-white/24"
                  onFocus={(event) => {
                    if (event.currentTarget.value === "0") {
                      event.currentTarget.value = "";
                    }
                  }}
                  onBlur={(event) => {
                    if (event.currentTarget.value === "") {
                      event.currentTarget.value = "0";
                    }
                    void quantityRegistration.onBlur(event);
                  }}
                  name={quantityRegistration.name}
                  ref={quantityRegistration.ref}
                  onChange={quantityRegistration.onChange}
                />
                {errors[index]?.quantity?.message ? (
                  <span className="text-xs text-red-300">
                    {errors[index]?.quantity?.message}
                  </span>
                ) : null}
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
