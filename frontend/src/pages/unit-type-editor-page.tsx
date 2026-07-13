import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { getApiError } from "../api/api-errors";
import {
  createUnitType,
  deleteUnitType,
  getUnitType,
  updateUnitType
} from "../api/endpoints";
import { settingsKeys } from "../features/settings/settings-keys";
import { SettingsConfirmDialog } from "../components/settings/settings-confirm-dialog";
import { SettingsFormActions } from "../components/settings/settings-form-actions";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsSection } from "../components/settings/settings-section";
import { ScreenMessage } from "../components/ui/screen-message";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  unitsPerHour: z.coerce.number().gt(0, "Units per hour must be greater than zero"),
  displayOrder: z.coerce.number().min(0),
  active: z.boolean()
});

type FormValues = z.infer<typeof schema>;
type FormInput = z.input<typeof schema>;

export function UnitTypeEditorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { workTypeId, unitTypeId } = useParams();
  const isEditing = Boolean(unitTypeId);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const unitTypeQuery = useQuery({
    queryKey: workTypeId && unitTypeId ? settingsKeys.unitType(workTypeId, unitTypeId) : settingsKeys.workTypes(),
    queryFn: () => getUnitType(workTypeId!, unitTypeId!),
    enabled: Boolean(workTypeId && unitTypeId)
  });

  const form = useForm<FormInput, undefined, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      unitsPerHour: 1,
      displayOrder: 0,
      active: true
    }
  });

  useEffect(() => {
    if (!unitTypeQuery.data) return;
    form.reset({
      name: unitTypeQuery.data.name,
      unitsPerHour: Number(unitTypeQuery.data.unitsPerHour),
      displayOrder: unitTypeQuery.data.displayOrder,
      active: unitTypeQuery.data.active
    });
  }, [form, unitTypeQuery.data]);

  async function afterSuccess() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: settingsKeys.unitTypes(workTypeId!) }),
      queryClient.invalidateQueries({ queryKey: ["unit-types"] }),
      queryClient.invalidateQueries({ queryKey: ["work-types"] })
    ]);
    navigate(`/settings/work-types/${workTypeId}`);
  }

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEditing
        ? updateUnitType(workTypeId!, unitTypeId!, values)
        : createUnitType(workTypeId!, values),
    onSuccess: async () => {
      setSuccessMessage(isEditing ? "Unit type updated." : "Unit type created.");
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
    mutationFn: () => deleteUnitType(workTypeId!, unitTypeId!),
    onSuccess: async () => {
      setShowConfirm(false);
      await afterSuccess();
    }
  });

  if (unitTypeQuery.isLoading) {
    return <ScreenMessage title="Loading unit type..." description="Bringing in the selected unit configuration." />;
  }

  if (unitTypeQuery.error) {
    return <ScreenMessage title="Unit type is unavailable" description={getApiError(unitTypeQuery.error).message} />;
  }

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader title={isEditing ? "Edit unit type" : "Add unit type"} />
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(async (values) => {
          await saveMutation.mutateAsync(values);
        })}
      >
        <SettingsSection title="Unit settings">
          <div className="space-y-4">
            <Input label="Name" error={form.formState.errors.name?.message} {...form.register("name")} />
            <Input type="number" min={0.01} step="0.01" label="Units per hour" error={form.formState.errors.unitsPerHour?.message} {...form.register("unitsPerHour")} />
            <Input type="number" min={0} label="Display order" error={form.formState.errors.displayOrder?.message} {...form.register("displayOrder")} />
            {isEditing ? (
              <Select label="Status" error={form.formState.errors.active?.message as string | undefined} {...form.register("active", { setValueAs: (value) => value === "true" || value === true })}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            ) : null}
          </div>
        </SettingsSection>

        <SettingsFormActions
          submitting={saveMutation.isPending}
          successMessage={successMessage}
          onDelete={isEditing ? () => setShowConfirm(true) : undefined}
          deleteLabel={isEditing ? "Deactivate unit type" : undefined}
          deleteDisabled={deleteMutation.isPending}
        />
        {saveMutation.error ? <p className="text-sm text-red-300">{getApiError(saveMutation.error).message}</p> : null}
      </form>

      <SettingsConfirmDialog
        open={showConfirm}
        title="Deactivate unit type?"
        description="Historical entry snapshots remain unchanged. This only removes the unit from future entry creation."
        confirmLabel="Deactivate"
        pending={deleteMutation.isPending}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => void deleteMutation.mutateAsync()}
      />
    </div>
  );
}
