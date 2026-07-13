import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { getApiError } from "../api/api-errors";
import {
  createWorkType,
  deleteWorkType,
  getWorkType,
  listUnitTypes,
  updateWorkType
} from "../api/endpoints";
import { settingsKeys } from "../features/settings/settings-keys";
import { SettingsConfirmDialog } from "../components/settings/settings-confirm-dialog";
import { SettingsEmptyState } from "../components/settings/settings-empty-state";
import { SettingsFormActions } from "../components/settings/settings-form-actions";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsSection } from "../components/settings/settings-section";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScreenMessage } from "../components/ui/screen-message";
import { Select } from "../components/ui/select";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  calculationMethod: z.enum(["TIME_BASED", "UNIT_BASED"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a valid #RRGGBB color"),
  icon: z.string().max(100).optional(),
  defaultBreakMinutes: z.union([z.literal(""), z.coerce.number().min(0)]),
  displayOrder: z.coerce.number().min(0),
  active: z.boolean()
});

type FormValues = z.infer<typeof schema>;
type FormInput = z.input<typeof schema>;

const palette = ["#FFFFFF", "#D4D4D8", "#A1A1AA", "#71717A", "#52525B", "#3F3F46"];

export function WorkTypeEditorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { workTypeId } = useParams();
  const isEditing = Boolean(workTypeId);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const workTypeQuery = useQuery({
    queryKey: workTypeId ? settingsKeys.workType(workTypeId) : settingsKeys.workTypes(),
    queryFn: () => getWorkType(workTypeId!),
    enabled: isEditing
  });

  const unitTypesQuery = useQuery({
    queryKey: workTypeId ? settingsKeys.unitTypes(workTypeId) : settingsKeys.workTypes(),
    queryFn: () => listUnitTypes(workTypeId!),
    enabled: Boolean(workTypeId && workTypeQuery.data?.calculationMethod === "UNIT_BASED")
  });

  const form = useForm<FormInput, undefined, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      calculationMethod: "TIME_BASED",
      color: "#FFFFFF",
      icon: "",
      defaultBreakMinutes: 30,
      displayOrder: 0,
      active: true
    }
  });

  const calculationMethod = form.watch("calculationMethod");

  useEffect(() => {
    if (!workTypeQuery.data) return;
    form.reset({
      name: workTypeQuery.data.name,
      calculationMethod: workTypeQuery.data.calculationMethod,
      color: workTypeQuery.data.color,
      icon: workTypeQuery.data.icon ?? "",
      defaultBreakMinutes: workTypeQuery.data.defaultBreakMinutes ?? "",
      displayOrder: workTypeQuery.data.displayOrder,
      active: workTypeQuery.data.active
    });
  }, [form, workTypeQuery.data]);

  async function afterSuccess(targetId?: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: settingsKeys.workTypes() }),
      queryClient.invalidateQueries({ queryKey: ["work-types"] }),
      queryClient.invalidateQueries({ queryKey: ["unit-types"] })
    ]);
    navigate(targetId ? `/settings/work-types/${targetId}` : "/settings/work-types");
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: values.name.trim(),
        calculationMethod: values.calculationMethod,
        color: values.color,
        icon: values.icon?.trim() ? values.icon.trim() : null,
        defaultBreakMinutes:
          values.calculationMethod === "TIME_BASED" && values.defaultBreakMinutes !== ""
            ? Number(values.defaultBreakMinutes)
            : null,
        displayOrder: values.displayOrder,
        active: values.active
      };

      return isEditing
        ? updateWorkType(workTypeId!, payload)
        : createWorkType({
            name: payload.name,
            calculationMethod: payload.calculationMethod,
            color: payload.color,
            icon: payload.icon,
            defaultBreakMinutes: payload.defaultBreakMinutes,
            displayOrder: payload.displayOrder
          });
    },
    onSuccess: async (workType) => {
      setSuccessMessage(isEditing ? "Work type updated." : "Work type created.");
      await afterSuccess(workType.id);
    },
    onError: (error) => {
      const apiError = getApiError(error);
      Object.entries(apiError.fieldErrors).forEach(([field, message]) => {
        form.setError(field as keyof FormValues, { message });
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkType(workTypeId!),
    onSuccess: async () => {
      setShowConfirm(false);
      await afterSuccess();
    }
  });

  if (workTypeQuery.isLoading) {
    return <ScreenMessage title="Loading work type..." description="Bringing in this configuration." />;
  }

  if (workTypeQuery.error) {
    return <ScreenMessage title="Work type is unavailable" description={getApiError(workTypeQuery.error).message} />;
  }

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        title={isEditing ? "Edit work type" : "Add work type"}
        description="Time based tracks start, end and break. Unit based tracks quantities such as rooms, orders or stops."
      />
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(async (values) => {
          await saveMutation.mutateAsync(values);
        })}
      >
        <SettingsSection title="Core settings">
          <div className="space-y-4">
            <Input label="Name" error={form.formState.errors.name?.message} {...form.register("name")} />
            <Select label="Calculation method" error={form.formState.errors.calculationMethod?.message} {...form.register("calculationMethod")}>
              <option value="TIME_BASED">Time based</option>
              <option value="UNIT_BASED">Unit based</option>
            </Select>
            <Input label="Color" error={form.formState.errors.color?.message} {...form.register("color")} />
            <div className="flex flex-wrap gap-2">
              {palette.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => form.setValue("color", color, { shouldValidate: true })}
                  className="h-9 w-9 rounded-full border border-white/[0.08]"
                  style={{ backgroundColor: color }}
                  aria-label={`Choose color ${color}`}
                />
              ))}
            </div>
            <Input label="Icon" error={form.formState.errors.icon?.message} {...form.register("icon")} />
            {calculationMethod === "TIME_BASED" ? (
              <Input
                type="number"
                min={0}
                label="Default break (minutes)"
                error={form.formState.errors.defaultBreakMinutes?.message as string | undefined}
                {...form.register("defaultBreakMinutes")}
              />
            ) : null}
            <Input type="number" min={0} label="Display order" error={form.formState.errors.displayOrder?.message} {...form.register("displayOrder")} />
            {isEditing ? (
              <Select label="Status" error={form.formState.errors.active?.message as string | undefined} {...form.register("active", { setValueAs: (value) => value === "true" || value === true })}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            ) : null}
          </div>
        </SettingsSection>

        {isEditing && workTypeQuery.data?.calculationMethod === "UNIT_BASED" ? (
          <SettingsSection title="Units">
            <div className="space-y-4">
              <Button type="button" variant="secondary" className="w-full" onClick={() => navigate(`/settings/work-types/${workTypeId}/unit-types/new`)}>
                Add unit type
              </Button>
              {unitTypesQuery.data?.length ? (
                <div className="space-y-3">
                  {unitTypesQuery.data.map((unit) => (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => navigate(`/settings/work-types/${workTypeId}/unit-types/${unit.id}`)}
                      className="w-full rounded-[24px] border border-white/[0.05] bg-white/[0.03] px-4 py-4 text-left transition hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className={`text-[1rem] font-medium ${unit.active ? "text-white" : "text-white/44"}`}>
                            {unit.name}
                          </p>
                          <p className="mt-1 text-sm text-white/46">{unit.unitsPerHour} per hour</p>
                        </div>
                        <span className="text-xs uppercase tracking-[0.16em] text-white/28">
                          {unit.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <SettingsEmptyState
                  title="No unit types yet"
                  description="Add units such as rooms, apartments or suites for this work type."
                />
              )}
            </div>
          </SettingsSection>
        ) : null}

        <SettingsFormActions
          submitting={saveMutation.isPending}
          successMessage={successMessage}
          onDelete={isEditing ? () => setShowConfirm(true) : undefined}
          deleteLabel={isEditing ? "Deactivate work type" : undefined}
          deleteDisabled={deleteMutation.isPending}
        />
        {saveMutation.error ? (
          <p className="text-sm text-red-300">
            {formatWorkTypeError(getApiError(saveMutation.error).message)}
          </p>
        ) : null}
      </form>

      <SettingsConfirmDialog
        open={showConfirm}
        title="Deactivate work type?"
        description="Historical work entries stay intact. This work type simply becomes unavailable for new entries."
        confirmLabel="Deactivate"
        pending={deleteMutation.isPending}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => void deleteMutation.mutateAsync()}
      />
    </div>
  );
}

function formatWorkTypeError(message: string) {
  if (message.toLowerCase().includes("saved entries")) {
    return "This work type already has saved entries. Create a new work type instead.";
  }
  return message;
}
