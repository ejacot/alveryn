import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import {
  createHourlyRate,
  deleteHourlyRate,
  getHourlyRate,
  updateHourlyRate
} from "../api/endpoints";
import { SettingsConfirmDialog } from "../components/settings/settings-confirm-dialog";
import { SettingsFormActions } from "../components/settings/settings-form-actions";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { SettingsSection } from "../components/settings/settings-section";
import { ScreenMessage } from "../components/ui/screen-message";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";
import { todayLocalIsoDate } from "../utils/date";

const schema = z
  .object({
    hourlyRate: z.coerce.number().min(0, "Hourly rate must be zero or positive"),
    currency: z.string().length(3, "Use a three-letter currency code"),
    validFrom: z.string().min(1, "Start date is required"),
    validTo: z.string().optional()
  })
  .refine((values) => !values.validTo || values.validTo >= values.validFrom, {
    path: ["validTo"],
    message: "End date cannot be before start date"
  });

type FormValues = z.infer<typeof schema>;
type FormInput = z.input<typeof schema>;

export function HourlyRateEditorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { rateId } = useParams();
  const isEditing = Boolean(rateId);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const safeBack = useSafeBackNavigation({ fallback: "/settings/hourly-rates" });

  const rateQuery = useQuery({
    queryKey: rateId ? queryKeys.hourlyRates.detail(rateId) : queryKeys.hourlyRates.all(),
    queryFn: () => getHourlyRate(rateId!),
    enabled: isEditing
  });

  const form = useForm<FormInput, undefined, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      hourlyRate: 0,
      currency: "EUR",
      validFrom: todayLocalIsoDate(),
      validTo: ""
    }
  });

  useEffect(() => {
    if (!rateQuery.data) return;
    form.reset({
      hourlyRate: Number(rateQuery.data.hourlyRate),
      currency: rateQuery.data.currency,
      validFrom: rateQuery.data.validFrom,
      validTo: rateQuery.data.validTo ?? ""
    });
  }, [form, rateQuery.data]);

  async function afterSuccess() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.hourlyRates.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workEntries.all() })
    ]);
    navigate("/settings/hourly-rates");
  }

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEditing
        ? updateHourlyRate(rateId!, toRatePayload(values))
        : createHourlyRate(toRatePayload(values)),
    onSuccess: async () => {
      setSuccessMessage(isEditing ? "Hourly rate updated." : "Hourly rate added.");
      await afterSuccess();
    },
    onError: (error) => {
      const apiError = getApiError(error);
      Object.entries(apiError.fieldErrors).forEach(([field, message]) => {
        form.setError(field as keyof FormValues, { message });
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteHourlyRate(rateId!),
    onSuccess: async () => {
      setShowConfirm(false);
      await afterSuccess();
    }
  });

  const { confirmOrRun, dialog } = useUnsavedChangesGuard({
    isDirty:
      form.formState.isDirty &&
      !saveMutation.isPending &&
      !deleteMutation.isPending
  });

  if (rateQuery.isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (rateQuery.error) {
    return <ScreenMessage title="Hourly rate is unavailable" description={getApiError(rateQuery.error).message} />;
  }

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        title={isEditing ? "Edit hourly rate" : "Add hourly rate"}
        description="Saved work-entry amounts stay unchanged even when a rate period is updated or removed."
        fallbackHref="/settings/hourly-rates"
        onBack={() => confirmOrRun(safeBack)}
      />
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(async (values) => {
          await saveMutation.mutateAsync(values);
        })}
      >
        <SettingsSection title="Rate period">
          <div className="space-y-4">
            <Input type="number" step="0.01" min={0} label="Hourly rate" error={form.formState.errors.hourlyRate?.message} {...form.register("hourlyRate")} />
            <Select label="Currency" error={form.formState.errors.currency?.message} {...form.register("currency")}>
              {["EUR", "USD", "GBP", "CHF", "PLN", "RON"].map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
            <Input type="date" label="Valid from" error={form.formState.errors.validFrom?.message} {...form.register("validFrom")} />
            <Input type="date" label="Valid to" error={form.formState.errors.validTo?.message} {...form.register("validTo")} />
          </div>
        </SettingsSection>

        <SettingsFormActions
          submitting={saveMutation.isPending}
          successMessage={successMessage}
          onDelete={isEditing ? () => setShowConfirm(true) : undefined}
          deleteLabel={isEditing ? "Delete rate period" : undefined}
          deleteDisabled={deleteMutation.isPending}
        />
        {saveMutation.error ? <p className="text-sm text-red-300">{getApiError(saveMutation.error).message}</p> : null}
      </form>

      <SettingsConfirmDialog
        open={showConfirm}
        title="Delete rate period?"
        description="This removes the rate period, but saved work-entry amounts remain unchanged."
        confirmLabel="Delete period"
        pending={deleteMutation.isPending}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => void deleteMutation.mutateAsync()}
      />
      {dialog}
    </div>
  );
}

function toRatePayload(values: FormValues) {
  return {
    hourlyRate: values.hourlyRate,
    currency: values.currency.toUpperCase(),
    validFrom: values.validFrom,
    validTo: values.validTo?.trim() ? values.validTo : null
  };
}
